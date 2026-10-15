import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import ListTripsQueryDto from '../../dto/list-trips-query.dto';

const errorsFor = (plain: Record<string, unknown>) =>
  validateSync(plainToInstance(ListTripsQueryDto, plain)).map(
    (error) => error.property,
  );

describe('ListTripsQueryDto', () => {
  it('defaults to page 1, limit 20', () => {
    const dto = plainToInstance(ListTripsQueryDto, {});

    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
  });

  it('parses query-string numbers', () => {
    const dto = plainToInstance(ListTripsQueryDto, { page: '2', limit: '50' });

    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(50);
  });

  it.each([
    ['limit', '1001'],
    ['limit', '0'],
    ['page', '0'],
    ['status', 'FLYING'],
  ])('rejects %s = %p', (property, value) => {
    expect(errorsFor({ [property]: value })).toContain(property);
  });
});
