import { dayjs } from '../../date/dayjs';
import { BaseKafkaEvent, createKafkaEvent } from '../kafka.events';

interface ExampleEvent extends BaseKafkaEvent {
  userId: number;
}

describe('createKafkaEvent', () => {
  it('adds a fresh eventId and the current occurredAt to the payload', () => {
    const before = dayjs();

    const event = createKafkaEvent<ExampleEvent>({ userId: 7 });

    expect(event.userId).toBe(7);
    expect(event.eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(dayjs(event.occurredAt).isBefore(before)).toBe(false);
  });

  it('gives every event its own id', () => {
    const first = createKafkaEvent<ExampleEvent>({ userId: 7 });
    const second = createKafkaEvent<ExampleEvent>({ userId: 7 });

    expect(first.eventId).not.toBe(second.eventId);
  });
});
