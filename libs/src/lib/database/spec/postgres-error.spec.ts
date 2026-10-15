import { QueryFailedError } from 'typeorm';

import { isUniqueViolation, PG_UNIQUE_VIOLATION } from '../postgres-error';

const queryError = (driverError: Record<string, unknown>) =>
  new QueryFailedError('INSERT', [], driverError as unknown as Error);

describe('isUniqueViolation', () => {
  it('matches a unique violation of the named constraint', () => {
    const error = queryError({
      code: PG_UNIQUE_VIOLATION,
      constraint: 'UQ_x',
    });

    expect(isUniqueViolation(error, 'UQ_x')).toBe(true);
  });

  it('ignores a unique violation of another constraint', () => {
    const error = queryError({
      code: PG_UNIQUE_VIOLATION,
      constraint: 'UQ_y',
    });

    expect(isUniqueViolation(error, 'UQ_x')).toBe(false);
  });

  it('ignores another database error', () => {
    const error = queryError({ code: '23503', constraint: 'UQ_x' });

    expect(isUniqueViolation(error, 'UQ_x')).toBe(false);
  });

  it('ignores an error that is not from a query', () => {
    expect(isUniqueViolation(new Error('boom'), 'UQ_x')).toBe(false);
  });
});
