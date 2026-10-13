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

import {
  AuthEventMap,
  AuthKafkaTopic,
  TripEventMap,
  TripKafkaTopic,
} from '@masr3/libs';

import AuthEventsHandler from '../modules/events/auth-events.handler';
import TripEventsHandler from '../modules/events/trip-events.handler';
import KafkaEventDto from '../modules/events/dto/kafka-event.dto';
import NotifierService from '../modules/notification/notifier.service';
import { CONSUMED_EVENT_DTOS } from './kafka.constant';

type ConsumedEventMap = AuthEventMap & TripEventMap;

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
    private readonly authEvents: AuthEventsHandler,
    private readonly tripEvents: TripEventsHandler,
    private readonly notifier: NotifierService,
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
    // Each handler turns its event into notification intents; the notifier
    // records them and queues the deliveries.
    this.handlers = {
      [AuthKafkaTopic.USER_REGISTER]: (event) =>
        this.notifier.notify(this.authEvents.handleUserRegistered(event)),
      [AuthKafkaTopic.USER_LOGGED_IN]: (event) =>
        this.notifier.notify(this.authEvents.handleUserLoggedIn(event)),
      [AuthKafkaTopic.USER_LOGGED_OUT]: () =>
        this.notifier.notify(this.authEvents.handleUserLoggedOut()),
      [AuthKafkaTopic.USER_CHANGE_PASSWORD]: (event) =>
        this.notifier.notify(this.authEvents.handleUserChangedPassword(event)),
      [AuthKafkaTopic.PASSWORD_RESET_REQUESTED]: (event) =>
        this.notifier.notify(
          this.authEvents.handlePasswordResetRequested(event),
        ),
      [AuthKafkaTopic.PASSWORD_RESET_COMPLETED]: (event) =>
        this.notifier.notify(
          this.authEvents.handlePasswordResetCompleted(event),
        ),
      [TripKafkaTopic.STATUS_CHANGED]: async (event) =>
        this.notifier.notify(await this.tripEvents.handleStatusChanged(event)),
    };
  }

  async onModuleInit() {
    await this.consumer.connect();

    // fromBeginning only applies while the group has no committed offset:
    // auth events published before this service first ran are still
    // delivered. Trip events start at the latest offset, so subscribing to the
    // topic for the first time doesn't email every past trip.
    await this.consumer.subscribe({
      topics: Object.values(AuthKafkaTopic),
      fromBeginning: true,
    });
    await this.consumer.subscribe({
      topics: [TripKafkaTopic.STATUS_CHANGED],
      fromBeginning: false,
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

  /**
   * A message that can never succeed (unknown topic, bad JSON, failing its
   * topic's DTO in CONSUMED_EVENT_DTOS) is logged and skipped, so it cannot
   * block the partition behind it.
   *
   * Anything else — the database being down — is rethrown on purpose: the
   * offset is not committed and kafkajs retries, instead of the event being
   * acknowledged and lost.
   */
  private async handleMessage(payload: EachMessagePayload) {
    const topic = payload.topic;
    const handler = this.handlers[topic as keyof ConsumedEventMap];

    if (!handler) {
      this.logger.warn(`No handler registered for topic ${topic}`);

      return;
    }

    const event = KafkaConsumerService.parse(
      topic as keyof ConsumedEventMap,
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
    topic: keyof ConsumedEventMap,
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

  // Flattens nested errors into "driverId: driverId must be an integer number".
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
