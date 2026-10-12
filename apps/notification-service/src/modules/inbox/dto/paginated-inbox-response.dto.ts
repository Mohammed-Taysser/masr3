import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

import PaginationMetaDto from '../../../shared/pagination/pagination-meta.dto';
import InboxItemResponseDto from './inbox-item-response.dto';

class PaginatedInboxResponseDto {
  @Expose()
  @Type(() => InboxItemResponseDto)
  @ApiProperty({ type: [InboxItemResponseDto] })
  items: InboxItemResponseDto[];

  @Expose()
  @Type(() => PaginationMetaDto)
  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

export default PaginatedInboxResponseDto;
