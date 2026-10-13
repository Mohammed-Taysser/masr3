import { ClassConstructor } from 'class-transformer';

import { AuthKafkaTopic, TripKafkaTopic } from '@masr3/libs';

import AuthEventDto from '../modules/events/dto/auth-event.dto';
import KafkaEventDto from '../modules/events/dto/kafka-event.dto';
import PasswordResetRequestedEventDto from '../modules/events/dto/password-reset-requested-event.dto';
import TripStatusChangedEventDto from '../modules/events/dto/trip-status-changed-event.dto';
import UserLoggedInEventDto from '../modules/events/dto/user-logged-in-event.dto';

// The DTO each consumed topic is validated against before its handler runs.
// Typed by topic: a topic added to an enum without a DTO here does not compile.
const CONSUMED_EVENT_DTOS: Record<
  AuthKafkaTopic | TripKafkaTopic,
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

export { CONSUMED_EVENT_DTOS };
