import { ApiProperty } from '@nestjs/swagger';

import { IsMoney } from '@masr3/libs/money';

class CreateTripOfferDto {
  @ApiProperty({
    example: 90,
    description:
      'The fare the driver asks, in EGP (2 decimals). Equal to the proposed fare means "I accept your price".',
  })
  @IsMoney()
  amount: number;
}

export default CreateTripOfferDto;
