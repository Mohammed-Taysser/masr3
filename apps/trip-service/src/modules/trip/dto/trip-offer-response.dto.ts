import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

import { TripOfferStatusEnum } from '../trip.enum';

class TripOfferResponseDto {
  @Expose()
  @ApiProperty({ example: 12 })
  id: number;

  @Expose()
  @ApiProperty({ example: 7 })
  tripId: number;

  @Expose()
  @ApiProperty({ example: 5 })
  driverId: number;

  @Expose()
  @ApiProperty({ example: 90, description: 'EGP.' })
  amount: number;

  @Expose()
  @ApiProperty({
    enum: TripOfferStatusEnum,
    example: TripOfferStatusEnum.PENDING,
  })
  status: TripOfferStatusEnum;

  @Expose()
  @ApiProperty({ example: '2026-10-11T08:01:00.000Z' })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: '2026-10-11T08:01:00.000Z' })
  updatedAt: Date;
}

export default TripOfferResponseDto;
