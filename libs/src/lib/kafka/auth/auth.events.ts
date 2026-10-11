import { AuthKafkaTopic } from './auth.topics';

interface BaseAuthEvent {
  eventId: string;
  occurredAt: string;
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

interface AuthEventMap {
  [AuthKafkaTopic.USER_REGISTER]: UserRegisteredEvent;
  [AuthKafkaTopic.USER_LOGGED_IN]: UserLoggedInEvent;
  [AuthKafkaTopic.USER_LOGGED_OUT]: UserLoggedOutEvent;
  [AuthKafkaTopic.USER_CHANGE_PASSWORD]: UserChangedPasswordEvent;
  [AuthKafkaTopic.PASSWORD_RESET_REQUESTED]: PasswordResetRequestedEvent;
  [AuthKafkaTopic.PASSWORD_RESET_COMPLETED]: PasswordResetCompletedEvent;
}

export type {
  AuthEventMap,
  BaseAuthEvent,
  PasswordResetCompletedEvent,
  PasswordResetRequestedEvent,
  UserChangedPasswordEvent,
  UserLoggedInEvent,
  UserLoggedOutEvent,
  UserRegisteredEvent,
};
