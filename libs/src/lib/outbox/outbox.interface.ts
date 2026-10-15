import { BaseKafkaEvent } from '../kafka/kafka.events';

interface OutboxModuleOptions {
  // The service's relay queue, e.g. `trip-outbox-relay`. Never another
  // service's: Redis is shared.
  queue: string;
}

// Topic → event of everything a service publishes through its outbox.
type OutboxEventMapOf<EventMap> = {
  [Topic in keyof EventMap]: BaseKafkaEvent;
};

export type { OutboxEventMapOf, OutboxModuleOptions };
