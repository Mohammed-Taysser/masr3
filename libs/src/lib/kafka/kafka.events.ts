import { randomUUID } from 'node:crypto';

import { dayjs } from '../date/dayjs';

interface BaseKafkaEvent {
  eventId: string;
  occurredAt: string;
}

// What a producer supplies: the event without the fields every event gets.
type EventPayload<T extends BaseKafkaEvent> = Omit<T, keyof BaseKafkaEvent>;

function createKafkaEvent<T extends BaseKafkaEvent>(
  payload: EventPayload<T>,
): T {
  return {
    ...payload,
    eventId: randomUUID(),
    occurredAt: dayjs().toISOString(),
  } as T;
}

export { createKafkaEvent };
export type { BaseKafkaEvent, EventPayload };
