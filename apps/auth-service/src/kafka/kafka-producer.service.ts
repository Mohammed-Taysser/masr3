import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';

import { AuthEventMap } from '@masr3/libs';

@Injectable()
class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private readonly producer: Producer;

  constructor(configService: ConfigService) {
    const kafka = new Kafka({
      brokers: [configService.getOrThrow<string>('KAFKA_BROKER')],
      clientId: configService.getOrThrow<string>('KAFKA_CLIENT_ID'),
    });

    // Topics are created by kafka-create-topics.sh; a typo'd name should
    // fail loudly rather than quietly create a topic nobody consumes.
    this.producer = kafka.producer({ allowAutoTopicCreation: false });
  }

  async onModuleInit() {
    await this.producer.connect();
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
  }

  async publish<Topic extends keyof AuthEventMap>(
    topic: Topic,
    event: AuthEventMap[Topic],
  ) {
    try {
      await this.producer.send({
        topic,
        // Keyed by user so every event for one user lands on the same
        // partition and is consumed in the order it was produced.
        messages: [{ key: String(event.userId), value: JSON.stringify(event) }],
      });
    } catch (error) {
      this.logger.error(
        `Failed to publish ${topic} (${event.eventId}): ${(error as Error).message}`,
      );
    }
  }
}

export default KafkaProducerService;
