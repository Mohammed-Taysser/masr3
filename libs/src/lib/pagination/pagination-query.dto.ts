import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

import {
  PAGINATION_DEFAULT_LIMIT,
  PAGINATION_DEFAULT_PAGE,
  PAGINATION_MAX_LIMIT,
} from './pagination.constant';
import { PaginationQuery } from './pagination.interface';

// List query DTOs extend this and add their own filters.
class PaginationQueryDto implements PaginationQuery {
  @ApiPropertyOptional({
    type: Number,
    description: 'Page number, 1-based.',
    example: PAGINATION_DEFAULT_PAGE,
    default: PAGINATION_DEFAULT_PAGE,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = PAGINATION_DEFAULT_PAGE;

  @ApiPropertyOptional({
    type: Number,
    description: 'Number of items per page.',
    example: PAGINATION_DEFAULT_LIMIT,
    default: PAGINATION_DEFAULT_LIMIT,
    minimum: 1,
    maximum: PAGINATION_MAX_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGINATION_MAX_LIMIT)
  limit = PAGINATION_DEFAULT_LIMIT;
}

export default PaginationQueryDto;
