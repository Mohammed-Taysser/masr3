import { PaginatedResponseDto } from '@masr3/libs/pagination';

import AuditResponseDto from './audit-response.dto';

class PaginatedAuditsResponseDto extends PaginatedResponseDto(
  AuditResponseDto,
) {}

export default PaginatedAuditsResponseDto;
