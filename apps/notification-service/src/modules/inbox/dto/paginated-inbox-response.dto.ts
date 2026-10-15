import { PaginatedResponseDto } from '@masr3/libs/pagination';

import InboxItemResponseDto from './inbox-item-response.dto';

class PaginatedInboxResponseDto extends PaginatedResponseDto(
  InboxItemResponseDto,
) {}

export default PaginatedInboxResponseDto;
