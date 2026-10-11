import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, Max } from 'class-validator';

import { FARE_SCALE, MAX_FARE } from '../trip.constant';

class CreateTripOfferDto {
  @ApiProperty({
    example: 90,
    description:
      'The fare the driver asks, in EGP (2 decimals). Equal to the proposed fare means "I accept your price".',
  })
  @IsNumber({ maxDecimalPlaces: FARE_SCALE })
  @IsPositive()
  @Max(MAX_FARE)
  amount: number;
}

export default CreateTripOfferDto;
