import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer, TopicMessages } from 'kafkajs';

@Injectable()
class KafkaProducerService implements OnModuleDestroy {
  private readonly producer: Producer;
  private connected = false;

  constructor(configService: ConfigService) {
    const kafka = new Kafka({
      brokers: [configService.getOrThrow<string>('KAFKA_BROKER')],
      clientId: configService.getOrThrow<string>('KAFKA_CLIENT_ID'),
      // Fail a relay tick fast instead of holding its transaction open.
      retry: { retries: 2 },
    });

    // Idempotent with one request in flight: a retried send cannot reorder or
    // duplicate messages within a partition.
    this.producer = kafka.producer({
      allowAutoTopicCreation: false,
      idempotent: true,
      maxInFlightRequests: 1,
    });

    this.producer.on(this.producer.events.DISCONNECT, () => {
      this.connected = false;
    });
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
  }

  // Connects lazily so the service boots, and keeps writing to the outbox,
  // while Kafka is down. Errors are thrown, not swallowed: the relay keeps
  // unsent rows pending.
  async sendBatch(topicMessages: TopicMessages[]): Promise<void> {
    if (!this.connected) {
      await this.producer.connect();
      this.connected = true;
    }

    await this.producer.sendBatch({ topicMessages });
  }
}

export default KafkaProducerService;
