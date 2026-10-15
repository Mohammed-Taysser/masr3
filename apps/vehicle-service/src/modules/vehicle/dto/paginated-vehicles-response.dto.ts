import { PaginatedResponseDto } from '@masr3/libs/pagination';

import VehicleResponseDto from './vehicle-response.dto';

class PaginatedVehiclesResponseDto extends PaginatedResponseDto(
  VehicleResponseDto,
) {}

export default PaginatedVehiclesResponseDto;
