import { UserRoleEnum } from '../../auth/auth.enum';
import { BaseKafkaEvent } from '../kafka.events';
import { UserChangeEnum } from './auth.enum';
import { AuthKafkaTopic } from './auth.topics';

interface BaseAuthEvent extends BaseKafkaEvent {
  userId: number;
  email: string;
  firstName: string;
}

type UserRegisteredEvent = BaseAuthEvent;

interface UserLoggedInEvent extends BaseAuthEvent {
  ip?: string;
  userAgent?: string;
}

type UserLoggedOutEvent = BaseAuthEvent;

type UserChangedPasswordEvent = BaseAuthEvent;

interface PasswordResetRequestedEvent extends BaseAuthEvent {
  resetToken: string;
  expiresAt: string;
}

type PasswordResetCompletedEvent = BaseAuthEvent;

// The whole current state, never a diff: a consumer keeping a copy of users
// only ever overwrites (or deletes) its row.
interface UserChangedEvent extends BaseKafkaEvent {
  userId: number;
  firstName: string;
  lastName: string;
  role: UserRoleEnum;
  isActive: boolean;
  change: UserChangeEnum;
}

interface AuthEventMap {
  [AuthKafkaTopic.USER_REGISTER]: UserRegisteredEvent;
  [AuthKafkaTopic.USER_LOGGED_IN]: UserLoggedInEvent;
  [AuthKafkaTopic.USER_LOGGED_OUT]: UserLoggedOutEvent;
  [AuthKafkaTopic.USER_CHANGE_PASSWORD]: UserChangedPasswordEvent;
  [AuthKafkaTopic.PASSWORD_RESET_REQUESTED]: PasswordResetRequestedEvent;
  [AuthKafkaTopic.PASSWORD_RESET_COMPLETED]: PasswordResetCompletedEvent;
  [AuthKafkaTopic.USER_CHANGED]: UserChangedEvent;
}

export type {
  AuthEventMap,
  BaseAuthEvent,
  PasswordResetCompletedEvent,
  PasswordResetRequestedEvent,
  UserChangedEvent,
  UserChangedPasswordEvent,
  UserLoggedInEvent,
  UserLoggedOutEvent,
  UserRegisteredEvent,
};
