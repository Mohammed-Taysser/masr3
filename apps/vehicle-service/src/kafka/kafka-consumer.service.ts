import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validateSync, ValidationError } from 'class-validator';
import { Consumer, EachMessagePayload, Kafka } from 'kafkajs';

import { AuthEventMap, AuthKafkaTopic } from '@masr3/libs/kafka';

import DriverService from '../modules/driver/driver.service';
import KafkaEventDto from '../modules/driver/dto/kafka-event.dto';
import { CONSUMED_EVENT_DTOS, ConsumedKafkaTopic } from './kafka.constant';

type ConsumedEventMap = Pick<AuthEventMap, ConsumedKafkaTopic>;

type TopicHandlers = {
  [Topic in keyof ConsumedEventMap]: (
    event: ConsumedEventMap[Topic],
  ) => Promise<unknown>;
};

@Injectable()
class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private readonly consumer: Consumer;
  private readonly handlers: TopicHandlers;

  constructor(
    configService: ConfigService,
    private readonly driverService: DriverService,
  ) {
    const kafka = new Kafka({
      brokers: [configService.getOrThrow<string>('KAFKA_BROKER')],
      clientId: configService.getOrThrow<string>('KAFKA_CLIENT_ID'),
    });

    this.consumer = kafka.consumer({
      groupId: configService.getOrThrow<string>('KAFKA_CONSUMER_GROUP_ID'),
      allowAutoTopicCreation: false,
    });

    this.handlers = {
      [AuthKafkaTopic.USER_CHANGED]: (event) =>
        this.driverService.applyUserChanged(event),
    };
  }

  async onModuleInit() {
    await this.consumer.connect();

    // fromBeginning only applies while the group has no committed offset: a
    // new deployment rebuilds its copy of drivers from the whole topic.
    await this.consumer.subscribe({
      topics: [AuthKafkaTopic.USER_CHANGED],
      fromBeginning: true,
    });

    await this.consumer.run({
      eachMessage: (payload) => this.handleMessage(payload),
    });

    const topics = Object.keys(this.handlers);

    this.logger.log(
      `Successfully subscribed to ${topics.length} Kafka topic(s): ${topics.join(', ')}`,
    );
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
  }

  // A message that can never succeed (unknown topic, bad JSON, failing its
  // DTO) is logged and skipped so it cannot block its partition. Anything else
  // is rethrown: the offset is not committed and kafkajs retries.
  private async handleMessage(payload: EachMessagePayload) {
    const topic = payload.topic;
    const handler = this.handlers[topic as ConsumedKafkaTopic];

    if (!handler) {
      this.logger.warn(`No handler registered for topic ${topic}`);

      return;
    }

    const event = KafkaConsumerService.parse(
      topic as ConsumedKafkaTopic,
      payload.message.value,
    );

    if (typeof event === 'string') {
      this.logger.error(
        `Skipping malformed message on ${topic}[${payload.partition}] at offset ${payload.message.offset}: ${event}`,
      );

      return;
    }

    await handler(event as never);
  }

  // Returns the event validated against its topic's DTO, or why it can never
  // be handled.
  private static parse(
    topic: ConsumedKafkaTopic,
    value: Buffer | null,
  ): KafkaEventDto | string {
    if (!value) {
      return 'empty message';
    }

    let raw: unknown;

    try {
      raw = JSON.parse(value.toString());
    } catch {
      return 'invalid JSON';
    }

    const isObject =
      typeof raw === 'object' && raw !== null && !Array.isArray(raw);

    if (!isObject) {
      return 'not a JSON object';
    }

    const event = plainToInstance(CONSUMED_EVENT_DTOS[topic], raw);
    const errors = validateSync(event);

    return errors.length > 0
      ? KafkaConsumerService.describe(errors).join('; ')
      : event;
  }

  // Flattens nested errors into "userId: userId must be an integer number".
  private static describe(errors: ValidationError[], path = ''): string[] {
    return errors.flatMap((error) => {
      const property = `${path}${error.property}`;
      const messages = Object.values(error.constraints ?? {}).map(
        (message) => `${property}: ${message}`,
      );

      return [
        ...messages,
        ...KafkaConsumerService.describe(error.children ?? [], `${property}.`),
      ];
    });
  }
}

export default KafkaConsumerService;
