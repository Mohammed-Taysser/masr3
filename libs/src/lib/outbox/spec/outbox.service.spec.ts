import { EntityManager } from 'typeorm';

import { BaseKafkaEvent } from '../../kafka/kafka.events';
import OutboxEventEntity from '../entities/outbox-event.entity';
import OutboxService from '../outbox.service';

interface ExampleEvent extends BaseKafkaEvent {
  exampleId: number;
}

interface ExampleEventMap {
  'example.happened': ExampleEvent;
}

describe('OutboxService', () => {
  it('inserts the event through the caller’s manager, with a fresh eventId and occurredAt', async () => {
    const manager = {
      insert: jest.fn(),
    } as unknown as jest.Mocked<EntityManager>;

    await new OutboxService<ExampleEventMap>().enqueue(
      manager,
      'example.happened',
      { exampleId: 7 },
      '7',
    );

    const [entity, row] = manager.insert.mock.calls[0] as [
      unknown,
      { eventId: string; payload: ExampleEvent },
    ];

    expect(entity).toBe(OutboxEventEntity);
    expect(row).toEqual({
      eventId: expect.any(String),
      topic: 'example.happened',
      key: '7',
      payload: {
        exampleId: 7,
        eventId: row.eventId,
        occurredAt: expect.any(String),
      },
    });
  });
});
