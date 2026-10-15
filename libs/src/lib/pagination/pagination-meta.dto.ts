import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

import { PaginationMeta } from './pagination.interface';

class PaginationMetaDto implements PaginationMeta {
  @Expose()
  @ApiProperty({ example: 1, description: 'Current page number, 1-based.' })
  page!: number;

  @Expose()
  @ApiProperty({ example: 20, description: 'Number of items per page.' })
  limit!: number;

  @Expose()
  @ApiProperty({ example: 42, description: 'Total items matching the query.' })
  total!: number;

  @Expose()
  @ApiProperty({ example: 3, description: 'Total number of pages.' })
  totalPages!: number;

  @Expose()
  @ApiProperty({ example: true })
  hasNextPage!: boolean;

  @Expose()
  @ApiProperty({ example: false })
  hasPreviousPage!: boolean;
}

export default PaginationMetaDto;
