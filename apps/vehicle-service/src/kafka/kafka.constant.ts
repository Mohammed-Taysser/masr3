import {
  AuthEventMap,
  AuthKafkaTopic,
  KafkaEventDtos,
} from '@masr3/libs/kafka';

import UserChangedEventDto from '../modules/driver/dto/user-changed-event.dto';

// Each service has its own relay queue: Redis is shared.
const VEHICLE_OUTBOX_RELAY_QUEUE = 'vehicle-outbox-relay';

type ConsumedKafkaTopic = AuthKafkaTopic.USER_CHANGED;

// The DTO each consumed topic is validated against before its handler runs.
const CONSUMED_EVENT_DTOS: KafkaEventDtos<
  Pick<AuthEventMap, ConsumedKafkaTopic>
> = {
  [AuthKafkaTopic.USER_CHANGED]: UserChangedEventDto,
};

export { CONSUMED_EVENT_DTOS, VEHICLE_OUTBOX_RELAY_QUEUE };
export type { ConsumedKafkaTopic };
