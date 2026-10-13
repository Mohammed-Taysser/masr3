import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { POSTGRES_INT_MAX } from '../../audit.constant';
import AuditActionRecordedEventDto from '../../dto/audit-action-recorded-event.dto';

const event = {
  eventId: 'event-1',
  occurredAt: '2026-10-01T12:00:00.000Z',
  schemaVersion: 1,
  service: 'trip-service',
  action: 'STATUS_CHANGED',
  entity: { type: 'TRIP', id: 42 },
  actor: { type: 'USER', id: 7, role: 'DRIVER' },
  changes: { status: { old: 'REQUESTED', new: 'ACCEPTED' } },
  metadata: { reason: null },
};

const errorsFor = (plain: Record<string, unknown>) =>
  validateSync(plainToInstance(AuditActionRecordedEventDto, plain)).map(
    (error) => error.property,
  );

describe('AuditActionRecordedEventDto', () => {
  it('accepts a complete event', () => {
    expect(errorsFor(event)).toEqual([]);
  });

  it('accepts a SYSTEM actor with no id, role, changes or metadata', () => {
    expect(
      errorsFor({
        ...event,
        actor: { type: 'SYSTEM', id: null, role: null },
        changes: null,
        metadata: null,
      }),
    ).toEqual([]);
  });

  // A producer may add a value before audit-service is redeployed: it must be
  // recorded, not skipped.
  it('accepts an action, entity type and actor type it does not know yet', () => {
    expect(
      errorsFor({
        ...event,
        action: 'RATING_SUBMITTED',
        entity: { type: 'RATING', id: 1 },
        actor: { type: 'PARTNER', id: null, role: null },
      }),
    ).toEqual([]);
  });

  it.each([
    ['eventId', { eventId: undefined }],
    ['eventId', { eventId: '' }],
    ['occurredAt', { occurredAt: 'yesterday' }],
    ['occurredAt', { occurredAt: undefined }],
    ['schemaVersion', { schemaVersion: '1' }],
    ['service', { service: '' }],
    ['action', { action: 42 }],
    ['entity', { entity: undefined }],
    ['entity', { entity: { type: 'TRIP', id: '42' } }],
    ['entity', { entity: { type: 'TRIP', id: POSTGRES_INT_MAX + 1 } }],
    ['entity', { entity: { type: '', id: 42 } }],
    ['actor', { actor: undefined }],
    ['actor', { actor: { type: 'USER', id: 'seven', role: null } }],
    ['actor', { actor: { type: 'USER', id: 7, role: 3 } }],
    ['changes', { changes: 'status changed' }],
    ['metadata', { metadata: [1, 2] }],
  ])('rejects a bad %s', (property, override) => {
    expect(errorsFor({ ...event, ...override })).toContain(property);
  });
});
