import { UserRoleEnum } from '../../auth/auth.enum';
import { BaseKafkaEvent } from '../kafka.events';
import {
  AuditActionEnum,
  AuditActorTypeEnum,
  AuditEntityTypeEnum,
} from './audit.enum';
import { AuditKafkaTopic } from './audit.topics';

interface AuditFieldChange {
  old: unknown;
  new: unknown;
}

type AuditChanges = Record<string, AuditFieldChange>;

interface AuditEntityReference {
  type: AuditEntityTypeEnum;
  id: number;
}

interface AuditActor {
  type: AuditActorTypeEnum;
  // Both null unless the actor is a signed-in USER.
  id: number | null;
  role: UserRoleEnum | null;
}

interface AuditActionRecordedEvent extends BaseKafkaEvent {
  schemaVersion: number;
  // The producer's SERVICE_NAME, e.g. trip-service.
  service: string;
  action: AuditActionEnum;
  entity: AuditEntityReference;
  actor: AuditActor;
  // Never a password, hash or token: build it with buildAuditChanges.
  changes: AuditChanges | null;
  metadata: Record<string, unknown> | null;
}

interface AuditEventMap {
  [AuditKafkaTopic.ACTION_RECORDED]: AuditActionRecordedEvent;
}

export type {
  AuditActionRecordedEvent,
  AuditActor,
  AuditChanges,
  AuditEntityReference,
  AuditEventMap,
  AuditFieldChange,
};
