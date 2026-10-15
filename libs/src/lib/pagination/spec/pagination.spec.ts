import { paginate, paginationWindow } from '../pagination';

describe('paginationWindow', () => {
  it('skips the pages before the requested one', () => {
    expect(paginationWindow({ page: 3, limit: 20 })).toEqual({
      skip: 40,
      take: 20,
    });
  });

  it('starts at 0 on the first page', () => {
    expect(paginationWindow({ page: 1, limit: 10 })).toEqual({
      skip: 0,
      take: 10,
    });
  });
});

describe('paginate', () => {
  it('builds the meta for a middle page', () => {
    const result = paginate(['a', 'b'], 42, { page: 2, limit: 20 });

    expect(result.items).toEqual(['a', 'b']);
    expect(result.meta).toEqual({
      page: 2,
      limit: 20,
      total: 42,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  it('has no next page on the last one', () => {
    const result = paginate(['a'], 41, { page: 3, limit: 20 });

    expect(result.meta.hasNextPage).toBe(false);
  });

  it('has zero pages when nothing matches', () => {
    const result = paginate([], 0, { page: 1, limit: 20 });

    expect(result.meta).toMatchObject({
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });
});
