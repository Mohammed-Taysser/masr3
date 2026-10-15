import { PaginatedResponseDto } from '@masr3/libs/pagination';

import OpenTripResponseDto from './open-trip-response.dto';
import TripResponseDto from './trip-response.dto';

class PaginatedTripsResponseDto extends PaginatedResponseDto(TripResponseDto) {}

class PaginatedOpenTripsResponseDto extends PaginatedResponseDto(
  OpenTripResponseDto,
) {}

export default PaginatedTripsResponseDto;
export { PaginatedOpenTripsResponseDto };
