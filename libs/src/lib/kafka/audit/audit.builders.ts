import { UserRoleEnum } from '../../auth/auth.enum';
import { AuditActorTypeEnum } from './audit.enum';
import { AuditActor, AuditChanges, AuditEntityReference } from './audit.events';

// Only the listed fields are compared, so a secret column can never reach a
// diff by accident. A null `before` records a creation, a null `after` a
// deletion.
function buildAuditChanges<T extends object>(
  before: T | null,
  after: T | null,
  fields: readonly (keyof T & string)[],
): AuditChanges | null {
  const changes: AuditChanges = {};

  for (const field of fields) {
    const oldValue = before ? before[field] : null;
    const newValue = after ? after[field] : null;

    if (!isSameValue(oldValue, newValue)) {
      changes[field] = { old: oldValue ?? null, new: newValue ?? null };
    }
  }

  return Object.keys(changes).length > 0 ? changes : null;
}

// Keys every audit event by its entity, so one entity's history stays on one
// partition and is consumed in order.
function buildAuditEventKey(entity: AuditEntityReference): string {
  return `${entity.type}-${entity.id}`;
}

function buildUserAuditActor(user: {
  id: number;
  role: UserRoleEnum;
}): AuditActor {
  return { type: AuditActorTypeEnum.USER, id: user.id, role: user.role };
}

function isSameValue(first: unknown, second: unknown): boolean {
  return JSON.stringify(first ?? null) === JSON.stringify(second ?? null);
}

export { buildAuditChanges, buildAuditEventKey, buildUserAuditActor };
