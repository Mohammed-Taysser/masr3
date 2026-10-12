import { EntityManager } from 'typeorm';

import {
  TripActorEnum,
  TripKafkaTopic,
  EventPayload,
  TripStatusChangedEvent,
  TripStatusEnum,
  TripTypeEnum,
} from '@masr3/libs';

import OutboxEventEntity from '../entities/outbox-event.entity';
import OutboxService from '../outbox.service';

describe('OutboxService', () => {
  const payload: EventPayload<TripStatusChangedEvent> = {
    tripId: 7,
    type: TripTypeEnum.RIDE,
    customerId: 1,
    driverId: null,
    fromStatus: null,
    toStatus: TripStatusEnum.REQUESTED,
    actor: TripActorEnum.CUSTOMER,
    actorId: 1,
    reason: null,
    pickupAddress: 'Tahrir Square',
    dropoffAddress: 'Giza',
    proposedFare: 85.5,
    agreedFare: null,
    currency: 'EGP',
  };

  it('inserts the event through the caller’s manager, with a fresh eventId and occurredAt', async () => {
    const manager = {
      insert: jest.fn(),
    } as unknown as jest.Mocked<EntityManager>;

    await new OutboxService().enqueue(
      manager,
      TripKafkaTopic.STATUS_CHANGED,
      payload,
      '7',
    );

    const [entity, row] = manager.insert.mock.calls[0] as [
      unknown,
      { eventId: string; payload: TripStatusChangedEvent },
    ];

    expect(entity).toBe(OutboxEventEntity);
    expect(row).toEqual({
      eventId: expect.any(String),
      topic: TripKafkaTopic.STATUS_CHANGED,
      key: '7',
      payload: {
        ...payload,
        eventId: row.eventId,
        occurredAt: expect.any(String),
      },
    });
  });
});
