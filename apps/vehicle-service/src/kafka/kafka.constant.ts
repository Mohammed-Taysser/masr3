import { AuthKafkaTopic, KafkaEventDtos } from '@masr3/libs/kafka';

import UserChangedEventDto from '../modules/driver/dto/user-changed-event.dto';
import { ConsumedEventMap } from './kafka.interface';

// Each service has its own relay queue: Redis is shared.
const VEHICLE_OUTBOX_RELAY_QUEUE = 'vehicle-outbox-relay';

// The DTO each consumed topic is validated against before its handler runs.
const CONSUMED_EVENT_DTOS: KafkaEventDtos<ConsumedEventMap> = {
  [AuthKafkaTopic.USER_CHANGED]: UserChangedEventDto,
};

export { CONSUMED_EVENT_DTOS, VEHICLE_OUTBOX_RELAY_QUEUE };
