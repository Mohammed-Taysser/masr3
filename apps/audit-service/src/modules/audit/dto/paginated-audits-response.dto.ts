import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

import PaginationMetaDto from '../../../shared/pagination/pagination-meta.dto';
import AuditResponseDto from './audit-response.dto';

class PaginatedAuditsResponseDto {
  @Expose()
  @Type(() => AuditResponseDto)
  @ApiProperty({ type: [AuditResponseDto] })
  items: AuditResponseDto[];

  @Expose()
  @Type(() => PaginationMetaDto)
  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

export default PaginatedAuditsResponseDto;
