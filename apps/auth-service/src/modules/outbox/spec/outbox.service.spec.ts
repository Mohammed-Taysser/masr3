import { EntityManager } from 'typeorm';

import {
  AUDIT_EVENT_SCHEMA_VERSION,
  AuditActionEnum,
  AuditActionRecordedEvent,
  AuditActorTypeEnum,
  AuditEntityTypeEnum,
  AuditKafkaTopic,
  EventPayload,
  UserRoleEnum,
} from '@masr3/libs';

import OutboxEventEntity from '../entities/outbox-event.entity';
import OutboxService from '../outbox.service';

describe('OutboxService', () => {
  const payload: EventPayload<AuditActionRecordedEvent> = {
    schemaVersion: AUDIT_EVENT_SCHEMA_VERSION,
    service: 'auth-service',
    action: AuditActionEnum.REGISTERED,
    entity: { type: AuditEntityTypeEnum.USER, id: 7 },
    actor: {
      type: AuditActorTypeEnum.USER,
      id: 7,
      role: UserRoleEnum.CUSTOMER,
    },
    changes: { email: { old: null, new: 'mona@example.com' } },
    metadata: null,
  };

  it('inserts the event through the caller’s manager, with a fresh eventId and occurredAt', async () => {
    const manager = {
      insert: jest.fn(),
    } as unknown as jest.Mocked<EntityManager>;

    await new OutboxService().enqueue(
      manager,
      AuditKafkaTopic.ACTION_RECORDED,
      payload,
      'USER-7',
    );

    const [entity, row] = manager.insert.mock.calls[0] as [
      unknown,
      { eventId: string; payload: AuditActionRecordedEvent },
    ];

    expect(entity).toBe(OutboxEventEntity);
    expect(row).toEqual({
      eventId: expect.any(String),
      topic: AuditKafkaTopic.ACTION_RECORDED,
      key: 'USER-7',
      payload: {
        ...payload,
        eventId: row.eventId,
        occurredAt: expect.any(String),
      },
    });
  });
});
