import { dayjs } from '../../date/dayjs';
import { UserRoleEnum } from '../../auth/auth.enum';
import {
  buildAuditChanges,
  buildAuditEventKey,
  buildUserAuditActor,
} from '../audit/audit.builders';
import { AuditActorTypeEnum, AuditEntityTypeEnum } from '../audit/audit.enum';

interface ExampleUser {
  firstName: string;
  isActive: boolean;
  password: string;
  updatedAt: Date;
}

const user: ExampleUser = {
  firstName: 'Mona',
  isActive: true,
  password: 'hash-1',
  updatedAt: dayjs('2026-10-01T10:00:00Z').toDate(),
};

describe('buildAuditChanges', () => {
  it('records only the listed fields that changed', () => {
    const changes = buildAuditChanges(
      user,
      { ...user, firstName: 'Mai', isActive: false, password: 'hash-2' },
      ['firstName', 'isActive'],
    );

    expect(changes).toEqual({
      firstName: { old: 'Mona', new: 'Mai' },
      isActive: { old: true, new: false },
    });
  });

  it('never records a field left out of the list', () => {
    const changes = buildAuditChanges(user, { ...user, password: 'hash-2' }, [
      'firstName',
    ]);

    expect(changes).toBeNull();
  });

  it('treats equal dates as unchanged', () => {
    const changes = buildAuditChanges(
      user,
      { ...user, updatedAt: dayjs(user.updatedAt).toDate() },
      ['updatedAt'],
    );

    expect(changes).toBeNull();
  });

  it('records every listed field of a creation as new', () => {
    expect(buildAuditChanges(null, user, ['firstName'])).toEqual({
      firstName: { old: null, new: 'Mona' },
    });
  });
});

describe('buildAuditChanges on deletion', () => {
  it('records every listed field as removed', () => {
    expect(buildAuditChanges(user, null, ['isActive'])).toEqual({
      isActive: { old: true, new: null },
    });
  });
});

describe('buildUserAuditActor', () => {
  it('keeps the user id and role', () => {
    expect(buildUserAuditActor({ id: 3, role: UserRoleEnum.ADMIN })).toEqual({
      type: AuditActorTypeEnum.USER,
      id: 3,
      role: UserRoleEnum.ADMIN,
    });
  });
});

describe('buildAuditEventKey', () => {
  it('keys by entity type and id', () => {
    expect(buildAuditEventKey({ type: AuditEntityTypeEnum.TRIP, id: 42 })).toBe(
      'TRIP-42',
    );
  });
});
