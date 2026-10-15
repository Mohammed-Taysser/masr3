interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

interface PaginationQuery {
  page: number;
  limit: number;
}

interface PaginationWindow {
  skip: number;
  take: number;
}

export type { Paginated, PaginationMeta, PaginationQuery, PaginationWindow };
