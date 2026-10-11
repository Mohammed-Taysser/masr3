import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

import PaginationMetaDto from '../../../shared/pagination/pagination-meta.dto';
import OpenTripResponseDto from './open-trip-response.dto';
import TripResponseDto from './trip-response.dto';

class PaginatedTripsResponseDto {
  @Expose()
  @Type(() => TripResponseDto)
  @ApiProperty({ type: [TripResponseDto] })
  items: TripResponseDto[];

  @Expose()
  @Type(() => PaginationMetaDto)
  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

class PaginatedOpenTripsResponseDto {
  @Expose()
  @Type(() => OpenTripResponseDto)
  @ApiProperty({ type: [OpenTripResponseDto] })
  items: OpenTripResponseDto[];

  @Expose()
  @Type(() => PaginationMetaDto)
  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

export default PaginatedTripsResponseDto;
export { PaginatedOpenTripsResponseDto };
