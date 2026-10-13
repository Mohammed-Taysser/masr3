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

export type { Paginated, PaginationMeta };
