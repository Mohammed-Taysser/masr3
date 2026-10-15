import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import PaginationQueryDto from '../pagination-query.dto';

const errorsFor = (plain: Record<string, unknown>) =>
  validateSync(plainToInstance(PaginationQueryDto, plain)).map(
    (error) => error.property,
  );

describe('PaginationQueryDto', () => {
  it('defaults to page 1, limit 20', () => {
    const dto = plainToInstance(PaginationQueryDto, {});

    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
  });

  it('parses query-string numbers', () => {
    const dto = plainToInstance(PaginationQueryDto, {
      page: '2',
      limit: '1000',
    });

    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(1000);
    expect(validateSync(dto)).toHaveLength(0);
  });

  it.each([
    ['limit', '1001'],
    ['limit', '0'],
    ['limit', '1.5'],
    ['page', '0'],
    ['page', 'abc'],
  ])('rejects %s = %p', (property, value) => {
    expect(errorsFor({ [property]: value })).toContain(property);
  });
});
