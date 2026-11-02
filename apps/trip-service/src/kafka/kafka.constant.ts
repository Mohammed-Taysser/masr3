import { AuthKafkaTopic, KafkaEventDtos } from '@masr3/libs/kafka';

import UserChangedEventDto from '../modules/user/dto/user-changed-event.dto';
import { ConsumedEventMap } from './kafka.interface';

// Each service has its own relay queue: Redis is shared.
const TRIP_OUTBOX_RELAY_QUEUE = 'trip-outbox-relay';

// The DTO each consumed topic is validated against before its handler runs.
const CONSUMED_EVENT_DTOS: KafkaEventDtos<ConsumedEventMap> = {
  [AuthKafkaTopic.USER_CHANGED]: UserChangedEventDto,
};

export { CONSUMED_EVENT_DTOS, TRIP_OUTBOX_RELAY_QUEUE };
