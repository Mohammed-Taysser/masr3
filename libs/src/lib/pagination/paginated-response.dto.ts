import { Type as ClassType } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

import PaginationMetaDto from './pagination-meta.dto';
import { Paginated } from './pagination.interface';

// A response DTO per item type, for Swagger and the serializer:
// class PaginatedTripsResponseDto extends PaginatedResponseDto(TripResponseDto) {}
function PaginatedResponseDto<T>(itemType: ClassType<T>) {
  class PaginatedResponse implements Paginated<T> {
    @Expose()
    @Type(() => itemType)
    @ApiProperty({ type: [itemType], description: 'Items on this page.' })
    items!: T[];

    @Expose()
    @Type(() => PaginationMetaDto)
    @ApiProperty({ type: PaginationMetaDto })
    meta!: PaginationMetaDto;
  }

  return PaginatedResponse;
}

export { PaginatedResponseDto };
