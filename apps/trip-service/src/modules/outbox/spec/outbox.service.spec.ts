import { EntityManager } from 'typeorm';

import {
  TripActorEnum,
  TripKafkaTopic,
  TripStatusChangedEvent,
  TripStatusEnum,
  TripTypeEnum,
} from '@masr3/libs';

import OutboxEventEntity from '../entities/outbox-event.entity';
import OutboxService from '../outbox.service';

describe('OutboxService', () => {
  const event: TripStatusChangedEvent = {
    eventId: '6f1c2a52-6b0e-4a43-9d3f-1d3c0f1f8a11',
    occurredAt: '2026-10-11T08:00:00.000Z',
    tripId: 7,
    type: TripTypeEnum.RIDE,
    customerId: 1,
    driverId: null,
    fromStatus: null,
    toStatus: TripStatusEnum.REQUESTED,
    actor: TripActorEnum.CUSTOMER,
    actorId: 1,
    reason: null,
    proposedFare: 85.5,
    agreedFare: null,
  };

  it('inserts the event through the caller’s manager', async () => {
    const manager = {
      insert: jest.fn(),
    } as unknown as jest.Mocked<EntityManager>;

    await new OutboxService().enqueue(
      manager,
      TripKafkaTopic.STATUS_CHANGED,
      event,
      '7',
    );

    expect(manager.insert).toHaveBeenCalledWith(OutboxEventEntity, {
      eventId: event.eventId,
      topic: TripKafkaTopic.STATUS_CHANGED,
      key: '7',
      payload: event,
    });
  });
});
