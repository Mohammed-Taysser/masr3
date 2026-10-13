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

import { AuditEventMap, AuditKafkaTopic } from '@masr3/libs';

import AuditService from '../modules/audit/audit.service';
import AuditActionRecordedEventDto from '../modules/audit/dto/audit-action-recorded-event.dto';

type ConsumedEventMap = AuditEventMap;

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
    private readonly auditService: AuditService,
  ) {
    const kafka = new Kafka({
      brokers: [configService.getOrThrow<string>('KAFKA_BROKER')],
      clientId: configService.getOrThrow<string>('KAFKA_CLIENT_ID'),
    });

    this.consumer = kafka.consumer({
      groupId: configService.getOrThrow<string>('KAFKA_CONSUMER_GROUP_ID'),
      allowAutoTopicCreation: false,
    });

    // Typed against every consumed event map: a topic added to the enum without a
    // handler here is a compile error, not a silently ignored event.
    // The envelope is generic, so a new audited action needs no new handler.
    this.handlers = {
      [AuditKafkaTopic.ACTION_RECORDED]: (event) =>
        this.auditService.record(event),
    };
  }

  async onModuleInit() {
    await this.consumer.connect();

    // fromBeginning only applies while the group has no committed offset: the
    // first run records every action already on the topic. Replays are safe
    // because each eventId is recorded once.
    await this.consumer.subscribe({
      topics: Object.values(AuditKafkaTopic),
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

  // A message that can never succeed (unknown topic, bad JSON, missing fields)
  // is logged and skipped, so it cannot block the partition behind it. Anything
  // else, such as the database being down, is rethrown: the offset is not
  // committed and kafkajs retries instead of losing the entry.
  private async handleMessage(payload: EachMessagePayload) {
    const topic = payload.topic;
    const handler = this.handlers[topic as keyof ConsumedEventMap];

    if (!handler) {
      this.logger.warn(`No handler registered for topic ${topic}`);

      return;
    }

    const event = KafkaConsumerService.parse(payload.message.value);

    if (typeof event === 'string') {
      this.logger.error(
        `Skipping malformed message on ${topic}[${payload.partition}] at offset ${payload.message.offset}: ${event}`,
      );

      return;
    }

    await handler(event);
  }

  // Returns the validated event, or why it can never be stored.
  private static parse(
    value: Buffer | null,
  ): AuditActionRecordedEventDto | string {
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

    const event = plainToInstance(AuditActionRecordedEventDto, raw);
    const errors = validateSync(event);

    return errors.length > 0
      ? KafkaConsumerService.describe(errors).join('; ')
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
        ...KafkaConsumerService.describe(error.children ?? [], `${property}.`),
      ];
    });
  }
}

export default KafkaConsumerService;
