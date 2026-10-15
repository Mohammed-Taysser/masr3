import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer, TopicMessages } from 'kafkajs';

import { KAFKA_PRODUCER_RETRIES } from './kafka.constant';

@Injectable()
class KafkaProducerService implements OnModuleDestroy {
  private readonly producer: Producer;
  private connecting: Promise<void> | null = null;

  constructor(configService: ConfigService) {
    const kafka = new Kafka({
      brokers: [configService.getOrThrow<string>('KAFKA_BROKER')],
      clientId: configService.getOrThrow<string>('KAFKA_CLIENT_ID'),
      retry: { retries: KAFKA_PRODUCER_RETRIES },
    });

    // Topics are created by each owner's kafka-create-topics.sh; a typo'd
    // name should fail loudly rather than quietly create a topic nobody
    // consumes. Idempotent with one request in flight: a retried send cannot
    // reorder or duplicate messages within a partition.
    // An idempotent producer otherwise retries a send without limit, ignoring
    // the client's retry. kafkajs warns that limiting it weakens exactly-once;
    // the outbox is at-least-once and consumers dedupe by eventId.
    this.producer = kafka.producer({
      allowAutoTopicCreation: false,
      idempotent: true,
      maxInFlightRequests: 1,
      retry: { retries: KAFKA_PRODUCER_RETRIES },
    });

    this.producer.on(this.producer.events.DISCONNECT, () => {
      this.connecting = null;
    });
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
  }

  // Errors are thrown, not swallowed: the outbox relay keeps unsent rows
  // pending.
  async sendBatch(topicMessages: TopicMessages[]): Promise<void> {
    await this.connect();
    await this.producer.sendBatch({ topicMessages });
  }

  // Connects lazily so the service boots, and keeps writing to its outbox,
  // while Kafka is down. Concurrent senders share one connection attempt.
  private connect(): Promise<void> {
    this.connecting ??= this.producer.connect().catch((error: unknown) => {
      this.connecting = null;

      throw error;
    });

    return this.connecting;
  }
}

export default KafkaProducerService;
