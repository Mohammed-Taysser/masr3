import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validateSync, ValidationError } from 'class-validator';
import { Consumer, EachMessagePayload, Kafka } from 'kafkajs';

import type KafkaEventDto from './kafka-event.dto';
import {
  KafkaEventDtos,
  KafkaSubscription,
  KafkaTopicHandlers,
} from './kafka.interface';

// Connects, subscribes, and validates each message against its topic's DTO
// before handing it to that topic's handler. A service's consumer extends it
// and supplies the handlers, the DTOs and its subscriptions.
abstract class BaseKafkaConsumer<EventMap>
  implements OnModuleInit, OnModuleDestroy
{
  protected readonly logger = new Logger(this.constructor.name);
  private readonly consumer: Consumer;

  protected abstract readonly handlers: KafkaTopicHandlers<EventMap>;
  protected abstract readonly eventDtos: KafkaEventDtos<EventMap>;
  protected abstract readonly subscriptions: KafkaSubscription<EventMap>[];

  constructor(configService: ConfigService) {
    const kafka = new Kafka({
      brokers: [configService.getOrThrow<string>('KAFKA_BROKER')],
      clientId: configService.getOrThrow<string>('KAFKA_CLIENT_ID'),
    });

    this.consumer = kafka.consumer({
      groupId: configService.getOrThrow<string>('KAFKA_CONSUMER_GROUP_ID'),
      allowAutoTopicCreation: false,
    });
  }

  async onModuleInit() {
    await this.consumer.connect();

    for (const subscription of this.subscriptions) {
      await this.consumer.subscribe({
        topics: subscription.topics,
        fromBeginning: subscription.fromBeginning,
      });
    }

    await this.consumer.run({
      eachMessage: (payload) => this.handleMessage(payload),
    });

    const topics = this.subscriptions.flatMap(
      (subscription) => subscription.topics,
    );

    this.logger.log(
      `Successfully subscribed to ${topics.length} Kafka topic(s): ${topics.join(', ')}`,
    );
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
  }

  // A message that can never succeed (unknown topic, bad JSON, failing its
  // topic's DTO) is logged and skipped, so it cannot block the partition
  // behind it. Anything else, such as the database being down, is rethrown:
  // the offset is not committed and kafkajs retries instead of losing it.
  private async handleMessage(payload: EachMessagePayload) {
    const topic = payload.topic as keyof EventMap;
    const handler = this.handlers[topic];

    if (!handler) {
      this.logger.warn(`No handler registered for topic ${payload.topic}`);

      return;
    }

    const event = this.parse(topic, payload.message.value);

    if (typeof event === 'string') {
      this.logger.error(
        `Skipping malformed message on ${payload.topic}[${payload.partition}] at offset ${payload.message.offset}: ${event}`,
      );

      return;
    }

    await handler(event as EventMap[keyof EventMap]);
  }

  // Returns the event validated against its topic's DTO, or why it can never
  // be handled.
  private parse(
    topic: keyof EventMap,
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

    const event = plainToInstance(this.eventDtos[topic], raw);
    const errors = validateSync(event);

    return errors.length > 0
      ? BaseKafkaConsumer.describe(errors).join('; ')
      : event;
  }

  // Flattens nested errors into "actor.id: id must be an integer number".
  private static describe(errors: ValidationError[], path = ''): string[] {
    return errors.flatMap((error) => {
      const property = `${path}${error.property}`;
      const messages = Object.values(error.constraints ?? {}).map(
        (message) => `${property}: ${message}`,
      );

      return [
        ...messages,
        ...BaseKafkaConsumer.describe(error.children ?? [], `${property}.`),
      ];
    });
  }
}

export default BaseKafkaConsumer;
