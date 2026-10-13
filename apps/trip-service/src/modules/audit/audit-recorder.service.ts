import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from 'typeorm';

import {
  AUDIT_EVENT_SCHEMA_VERSION,
  AuditKafkaTopic,
  buildAuditEventKey,
} from '@masr3/libs';

import OutboxService from '../outbox/outbox.service';
import { AuditRecord } from './audit.interface';

@Injectable()
class AuditRecorderService {
  private readonly serviceName: string;

  constructor(
    private readonly outboxService: OutboxService,
    configService: ConfigService,
  ) {
    this.serviceName = configService.getOrThrow<string>('SERVICE_NAME');
  }

  async record(manager: EntityManager, record: AuditRecord): Promise<void> {
    await this.outboxService.enqueue(
      manager,
      AuditKafkaTopic.ACTION_RECORDED,
      {
        schemaVersion: AUDIT_EVENT_SCHEMA_VERSION,
        service: this.serviceName,
        action: record.action,
        entity: record.entity,
        actor: record.actor,
        changes: record.changes,
        metadata: record.metadata,
      },
      buildAuditEventKey(record.entity),
    );
  }
}

export default AuditRecorderService;
