import { ClassConstructor } from 'class-transformer';

import { AuthKafkaTopic } from '@masr3/libs/kafka';

import KafkaEventDto from '../modules/driver/dto/kafka-event.dto';
import UserChangedEventDto from '../modules/driver/dto/user-changed-event.dto';

type ConsumedKafkaTopic = AuthKafkaTopic.USER_CHANGED;

// The DTO each consumed topic is validated against before its handler runs.
const CONSUMED_EVENT_DTOS: Record<
  ConsumedKafkaTopic,
  ClassConstructor<KafkaEventDto>
> = {
  [AuthKafkaTopic.USER_CHANGED]: UserChangedEventDto,
};

export { CONSUMED_EVENT_DTOS };
export type { ConsumedKafkaTopic };
