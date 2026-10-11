import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Consumer, EachMessagePayload, Kafka } from 'kafkajs';

import { AuthEventMap, AuthKafkaTopic, BaseAuthEvent } from '@masr3/libs';

import NotificationService from '../modules/notification/notification.service';

type TopicHandlers = {
  [Topic in keyof AuthEventMap]: (
    event: AuthEventMap[Topic],
  ) => Promise<unknown>;
};

@Injectable()
class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private readonly consumer: Consumer;
  private readonly handlers: TopicHandlers;

  constructor(
    configService: ConfigService,
    private readonly notificationService: NotificationService,
  ) {
    const kafka = new Kafka({
      brokers: [configService.getOrThrow<string>('KAFKA_BROKER')],
      clientId: configService.getOrThrow<string>('KAFKA_CLIENT_ID'),
    });

    this.consumer = kafka.consumer({
      groupId: configService.getOrThrow<string>('KAFKA_CONSUMER_GROUP_ID'),
      allowAutoTopicCreation: false,
    });

    // Typed against AuthEventMap: a topic added to the enum without a
    // handler here is a compile error, not a silently ignored event.
    this.handlers = {
      [AuthKafkaTopic.USER_REGISTER]: (event) =>
        this.notificationService.handleUserRegistered(event),
      [AuthKafkaTopic.USER_LOGGED_IN]: (event) =>
        this.notificationService.handleUserLoggedIn(event),
      [AuthKafkaTopic.USER_LOGGED_OUT]: (event) =>
        this.notificationService.handleUserLoggedOut(event),
      [AuthKafkaTopic.USER_CHANGE_PASSWORD]: (event) =>
        this.notificationService.handleUserChangedPassword(event),
      [AuthKafkaTopic.PASSWORD_RESET_REQUESTED]: (event) =>
        this.notificationService.handlePasswordResetRequested(event),
      [AuthKafkaTopic.PASSWORD_RESET_COMPLETED]: (event) =>
        this.notificationService.handlePasswordResetCompleted(event),
    };
  }

  async onModuleInit() {
    await this.consumer.connect();

    // fromBeginning only applies while the group has no committed offset:
    // events published before this service first ran are still delivered.
    await this.consumer.subscribe({
      topics: Object.keys(this.handlers),
      fromBeginning: true,
    });

    await this.consumer.run({
      eachMessage: (payload) => this.handleMessage(payload),
    });

    this.logger.log(
      `Subscribed to ${Object.keys(this.handlers).length} auth topics`,
    );
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
  }

  /**
   * A message that can never succeed (unknown topic, bad JSON, no eventId) is
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
    const handler = this.handlers[topic as keyof AuthEventMap];

    if (!handler) {
      this.logger.warn(`No handler registered for topic ${topic}`);

      return;
    }

    const event = this.parse(message.value);

    if (!event) {
      this.logger.error(
        `Skipping malformed message on ${topic}[${partition}] at offset ${message.offset}`,
      );

      return;
    }

    await handler(event as never);
  }

  private parse(value: Buffer | null): BaseAuthEvent | null {
    if (!value) {
      return null;
    }

    try {
      const event = JSON.parse(value.toString()) as BaseAuthEvent;

      return typeof event?.eventId === 'string' &&
        typeof event.email === 'string'
        ? event
        : null;
    } catch {
      return null;
    }
  }
}

export default KafkaConsumerService;
