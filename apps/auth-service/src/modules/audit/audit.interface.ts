import {
  AuditActionEnum,
  AuditActor,
  AuditChanges,
  AuditEntityReference,
} from '@masr3/libs/kafka';

// What a feature knows about one audited action. The recorder adds the rest of
// the envelope: schemaVersion, SERVICE_NAME, eventId, occurredAt and the key.
interface AuditRecord {
  action: AuditActionEnum;
  entity: AuditEntityReference;
  actor: AuditActor;
  // Built by the feature with buildAuditChanges and its own field allow-list.
  changes: AuditChanges | null;
  metadata: Record<string, unknown> | null;
}

export type { AuditRecord };
