import { PaginatedResponseDto } from '@masr3/libs/pagination';

import DeliveryResponseDto from './delivery-response.dto';

class PaginatedDeliveriesResponseDto extends PaginatedResponseDto(
  DeliveryResponseDto,
) {}

export default PaginatedDeliveriesResponseDto;
