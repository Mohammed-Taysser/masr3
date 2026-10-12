import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

import PaginationMetaDto from '../../../shared/pagination/pagination-meta.dto';
import DeliveryResponseDto from './delivery-response.dto';

class PaginatedDeliveriesResponseDto {
  @Expose()
  @Type(() => DeliveryResponseDto)
  @ApiProperty({ type: [DeliveryResponseDto] })
  items: DeliveryResponseDto[];

  @Expose()
  @Type(() => PaginationMetaDto)
  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

export default PaginatedDeliveriesResponseDto;
