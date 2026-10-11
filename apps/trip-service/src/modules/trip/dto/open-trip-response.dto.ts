import { OmitType } from '@nestjs/swagger';

import TripResponseDto from './trip-response.dto';

// Drivers browsing open trips must not see the parcel recipient's contact.
class OpenTripResponseDto extends OmitType(TripResponseDto, [
  'recipientName',
  'recipientPhone',
] as const) {}

export default OpenTripResponseDto;
