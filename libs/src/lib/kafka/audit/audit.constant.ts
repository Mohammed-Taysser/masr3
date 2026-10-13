import { AuditActorTypeEnum } from './audit.enum';
import { AuditActor } from './audit.events';

// Bump when the envelope changes shape; audit-service stores it on every row.
const AUDIT_EVENT_SCHEMA_VERSION = 1;

const SYSTEM_AUDIT_ACTOR: AuditActor = {
  type: AuditActorTypeEnum.SYSTEM,
  id: null,
  role: null,
};

const ANONYMOUS_AUDIT_ACTOR: AuditActor = {
  type: AuditActorTypeEnum.ANONYMOUS,
  id: null,
  role: null,
};

export {
  ANONYMOUS_AUDIT_ACTOR,
  AUDIT_EVENT_SCHEMA_VERSION,
  SYSTEM_AUDIT_ACTOR,
};
