import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

import { IsMoney } from '@masr3/libs/money';

class CreateTripOfferDto {
  @ApiProperty({
    example: 90,
    description:
      'The fare the driver asks, in EGP (2 decimals). Equal to the proposed fare means "I accept your price".',
  })
  @IsMoney()
  amount: number;

  @ApiPropertyOptional({
    example: 5,
    description:
      'The driver (auth user id) the offer is for. Required for an admin; a driver omits it.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  driverId?: number;
}

export default CreateTripOfferDto;
