import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  AuthEventMap,
  AuthKafkaTopic,
  BaseKafkaConsumer,
  KafkaSubscription,
  KafkaTopicHandlers,
  TripEventMap,
  TripKafkaTopic,
} from '@masr3/libs/kafka';

import AuthEventsHandler from '../modules/events/auth-events.handler';
import TripEventsHandler from '../modules/events/trip-events.handler';
import NotifierService from '../modules/notification/notifier.service';
import {
  CONSUMED_AUTH_TOPICS,
  CONSUMED_EVENT_DTOS,
  ConsumedAuthKafkaTopic,
} from './kafka.constant';

type ConsumedEventMap = Pick<AuthEventMap, ConsumedAuthKafkaTopic> &
  TripEventMap;

@Injectable()
class KafkaConsumerService extends BaseKafkaConsumer<ConsumedEventMap> {
  protected readonly handlers: KafkaTopicHandlers<ConsumedEventMap>;
  protected readonly eventDtos = CONSUMED_EVENT_DTOS;

  // fromBeginning only applies while the group has no committed offset: auth
  // events published before this service first ran are still delivered. Trip
  // events start at the latest offset, so subscribing to the topic for the
  // first time doesn't email every past trip.
  protected readonly subscriptions: KafkaSubscription<ConsumedEventMap>[] = [
    { topics: CONSUMED_AUTH_TOPICS, fromBeginning: true },
    { topics: [TripKafkaTopic.STATUS_CHANGED], fromBeginning: false },
  ];

  constructor(
    configService: ConfigService,
    private readonly authEvents: AuthEventsHandler,
    private readonly tripEvents: TripEventsHandler,
    private readonly notifier: NotifierService,
  ) {
    super(configService);

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
}

export default KafkaConsumerService;
