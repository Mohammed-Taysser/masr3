import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import ListAuditsQueryDto from '../../dto/list-audits-query.dto';

const errorsFor = (plain: Record<string, unknown>) =>
  validateSync(plainToInstance(ListAuditsQueryDto, plain)).map(
    (error) => error.property,
  );

describe('ListAuditsQueryDto', () => {
  it('defaults to page 1, limit 20', () => {
    const dto = plainToInstance(ListAuditsQueryDto, {});

    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
  });

  it('parses query-string numbers', () => {
    const dto = plainToInstance(ListAuditsQueryDto, {
      entityId: '42',
      actorId: '7',
    });

    expect(dto.entityId).toBe(42);
    expect(dto.actorId).toBe(7);
  });

  it('accepts every filter together', () => {
    expect(
      errorsFor({
        service: 'trip-service',
        action: 'STATUS_CHANGED',
        entityType: 'TRIP',
        entityId: '42',
        actorType: 'USER',
        actorId: '7',
        actorRole: 'DRIVER',
        occurredFrom: '2026-10-01T00:00:00Z',
        occurredTo: '2026-10-31T23:59:59Z',
      }),
    ).toEqual([]);
  });

  it.each([
    ['limit', '1001'],
    ['page', '0'],
    ['service', ''],
    ['action', 'FLEW'],
    ['entityType', 'PLANE'],
    ['entityId', '0'],
    ['actorType', 'ROBOT'],
    ['actorRole', 'PILOT'],
    ['occurredFrom', 'yesterday'],
    ['occurredTo', '2026-13-01'],
  ])('rejects %s = %p', (property, value) => {
    expect(errorsFor({ [property]: value })).toContain(property);
  });
});
