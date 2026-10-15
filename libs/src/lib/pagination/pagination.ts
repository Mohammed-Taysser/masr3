import {
  Paginated,
  PaginationQuery,
  PaginationWindow,
} from './pagination.interface';

function paginationWindow(query: PaginationQuery): PaginationWindow {
  return { skip: (query.page - 1) * query.limit, take: query.limit };
}

function paginate<T>(
  items: T[],
  total: number,
  query: PaginationQuery,
): Paginated<T> {
  return {
    items,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
      hasNextPage: query.page * query.limit < total,
      hasPreviousPage: query.page > 1,
    },
  };
}

export { paginate, paginationWindow };
