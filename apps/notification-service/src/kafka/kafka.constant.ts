import { ClassConstructor } from 'class-transformer';

import { AuthKafkaTopic, TripKafkaTopic } from '@masr3/libs/kafka';

import AuthEventDto from '../modules/events/dto/auth-event.dto';
import KafkaEventDto from '../modules/events/dto/kafka-event.dto';
import PasswordResetRequestedEventDto from '../modules/events/dto/password-reset-requested-event.dto';
import TripStatusChangedEventDto from '../modules/events/dto/trip-status-changed-event.dto';
import UserLoggedInEventDto from '../modules/events/dto/user-logged-in-event.dto';

// auth.user-changed is for services that keep a copy of users; nothing here
// is notified about it, so it is not consumed.
type ConsumedAuthKafkaTopic = Exclude<
  AuthKafkaTopic,
  AuthKafkaTopic.USER_CHANGED
>;

const CONSUMED_AUTH_TOPICS = Object.values(AuthKafkaTopic).filter(
  (topic): topic is ConsumedAuthKafkaTopic =>
    topic !== AuthKafkaTopic.USER_CHANGED,
);

// The DTO each consumed topic is validated against before its handler runs.
// Typed by topic: a topic added to an enum without a DTO here does not compile.
const CONSUMED_EVENT_DTOS: Record<
  ConsumedAuthKafkaTopic | TripKafkaTopic,
  ClassConstructor<KafkaEventDto>
> = {
  [AuthKafkaTopic.USER_REGISTER]: AuthEventDto,
  [AuthKafkaTopic.USER_LOGGED_IN]: UserLoggedInEventDto,
  [AuthKafkaTopic.USER_LOGGED_OUT]: AuthEventDto,
  [AuthKafkaTopic.USER_CHANGE_PASSWORD]: AuthEventDto,
  [AuthKafkaTopic.PASSWORD_RESET_REQUESTED]: PasswordResetRequestedEventDto,
  [AuthKafkaTopic.PASSWORD_RESET_COMPLETED]: AuthEventDto,
  [TripKafkaTopic.STATUS_CHANGED]: TripStatusChangedEventDto,
};

export { CONSUMED_AUTH_TOPICS, CONSUMED_EVENT_DTOS };
export type { ConsumedAuthKafkaTopic };
