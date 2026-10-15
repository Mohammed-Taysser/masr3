import { ClassConstructor } from 'class-transformer';

import type KafkaEventDto from './kafka-event.dto';

// Typed by the consumer's event map: a topic without a handler or a DTO does
// not compile.
type KafkaTopicHandlers<EventMap> = {
  [Topic in keyof EventMap]: (event: EventMap[Topic]) => Promise<unknown>;
};

type KafkaEventDtos<EventMap> = Record<
  keyof EventMap,
  ClassConstructor<KafkaEventDto>
>;

interface KafkaSubscription<EventMap> {
  topics: Extract<keyof EventMap, string>[];
  // Only applies while the consumer group has no committed offset.
  fromBeginning: boolean;
}

export type { KafkaEventDtos, KafkaSubscription, KafkaTopicHandlers };
