import {
  BaseAuthEvent,
  EventPayload,
  UserChangedEvent,
  UserChangeEnum,
} from '@masr3/libs/kafka';

import UserEntity from './entities/user.entity';

function buildUserChangedEvent(
  user: UserEntity,
  change: UserChangeEnum,
): EventPayload<UserChangedEvent> {
  return {
    userId: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isActive: user.isActive,
    change,
  };
}

// What notification-service needs to address the user: register, login,
// logout and the password events all carry it.
function buildAuthEvent(user: UserEntity): EventPayload<BaseAuthEvent> {
  return {
    userId: user.id,
    email: user.email,
    firstName: user.firstName,
  };
}

export { buildAuthEvent, buildUserChangedEvent };
