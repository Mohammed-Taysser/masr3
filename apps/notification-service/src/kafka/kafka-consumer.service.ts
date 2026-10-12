import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Consumer, EachMessagePayload, Kafka } from 'kafkajs';

import {
  AuthEventMap,
  AuthKafkaTopic,
  BaseKafkaEvent,
  TripEventMap,
  TripKafkaTopic,
} from '@masr3/libs';

import AuthEventsHandler from '../modules/events/auth-events.handler';
import TripEventsHandler from '../modules/events/trip-events.handler';
import NotifierService from '../modules/notification/notifier.service';

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
   * A message that can never succeed (unknown topic, bad JSON, missing fields) is
   * logged and skipped, so it cannot block the partition behind it.
   *
   * Anything else — the database being down — is rethrown on purpose: the
   * offset is not committed and kafkajs retries, instead of the event being
   * acknowledged and lost.
   */
  private async handleMessage({
    topic,
    partition,
    message,
  }: EachMessagePayload) {
    const handler = this.handlers[topic as keyof ConsumedEventMap];

    if (!handler) {
      this.logger.warn(`No handler registered for topic ${topic}`);

      return;
    }

    const event = KafkaConsumerService.parse(topic, message.value);

    if (!event) {
      this.logger.error(
        `Skipping malformed message on ${topic}[${partition}] at offset ${message.offset}`,
      );

      return;
    }

    await handler(event as never);
  }

  // Each topic names the fields its handler cannot do without.
  private static parse(
    topic: string,
    value: Buffer | null,
  ): BaseKafkaEvent | null {
    if (!value) {
      return null;
    }

    let event: Record<string, unknown>;

    try {
      event = JSON.parse(value.toString());
    } catch {
      return null;
    }

    if (typeof event?.['eventId'] !== 'string') {
      return null;
    }

    const isComplete =
      topic === TripKafkaTopic.STATUS_CHANGED
        ? Number.isInteger(event['tripId']) &&
          Number.isInteger(event['customerId']) &&
          typeof event['toStatus'] === 'string'
        : typeof event['email'] === 'string';

    return isComplete ? (event as unknown as BaseKafkaEvent) : null;
  }
}

export default KafkaConsumerService;
