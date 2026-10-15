import {
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

export { buildUserChangedEvent };
