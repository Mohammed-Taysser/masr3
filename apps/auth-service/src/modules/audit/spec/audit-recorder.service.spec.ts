import { ConfigService } from '@nestjs/config';
import { EntityManager } from 'typeorm';

import {
  AUDIT_EVENT_SCHEMA_VERSION,
  AuditActionEnum,
  AuditEntityTypeEnum,
  AuditKafkaTopic,
  SYSTEM_AUDIT_ACTOR,
} from '@masr3/libs/kafka';
import { OutboxService } from '@masr3/libs/outbox';

import { OutboxEventMap } from '../../../kafka/kafka.interface';
import AuditRecorderService from '../audit-recorder.service';
import { AuditRecord } from '../audit.interface';

describe('AuditRecorderService', () => {
  const record: AuditRecord = {
    action: AuditActionEnum.STATUS_CHANGED,
    entity: { type: AuditEntityTypeEnum.TRIP, id: 7 },
    actor: SYSTEM_AUDIT_ACTOR,
    changes: { status: { old: 'REQUESTED', new: 'EXPIRED' } },
    metadata: { reason: null },
  };

  it('enqueues the envelope in the caller’s transaction, keyed by entity, with SERVICE_NAME as the service', async () => {
    const outboxService = {
      enqueue: jest.fn(),
    } as unknown as jest.Mocked<OutboxService<OutboxEventMap>>;
    const configService = {
      getOrThrow: jest.fn().mockReturnValue('rating-service'),
    } as unknown as ConfigService;
    const manager = {} as EntityManager;

    await new AuditRecorderService(outboxService, configService).record(
      manager,
      record,
    );

    expect(configService.getOrThrow).toHaveBeenCalledWith('SERVICE_NAME');
    expect(outboxService.enqueue).toHaveBeenCalledWith(
      manager,
      AuditKafkaTopic.ACTION_RECORDED,
      {
        schemaVersion: AUDIT_EVENT_SCHEMA_VERSION,
        service: 'rating-service',
        action: AuditActionEnum.STATUS_CHANGED,
        entity: { type: AuditEntityTypeEnum.TRIP, id: 7 },
        actor: SYSTEM_AUDIT_ACTOR,
        changes: { status: { old: 'REQUESTED', new: 'EXPIRED' } },
        metadata: { reason: null },
      },
      'TRIP-7',
    );
  });
});
