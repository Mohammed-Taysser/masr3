import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

import { TripStatusEnum, TripTypeEnum } from '@masr3/libs/kafka';

class TripResponseDto {
  @Expose()
  @ApiProperty({ example: 7 })
  id: number;

  @Expose()
  @ApiProperty({ example: 2 })
  customerId: number;

  @Expose()
  @ApiProperty({
    example: 5,
    nullable: true,
    description: 'Set when an offer is accepted.',
  })
  driverId: number | null;

  @Expose()
  @ApiProperty({ enum: TripTypeEnum, example: TripTypeEnum.RIDE })
  type: TripTypeEnum;

  @Expose()
  @ApiProperty({ enum: TripStatusEnum, example: TripStatusEnum.REQUESTED })
  status: TripStatusEnum;

  @Expose()
  @ApiProperty({ example: 30.04442 })
  pickupLatitude: number;

  @Expose()
  @ApiProperty({ example: 31.235712 })
  pickupLongitude: number;

  @Expose()
  @ApiProperty({ example: 'Tahrir Square, Cairo' })
  pickupAddress: string;

  @Expose()
  @ApiProperty({ example: 30.0131 })
  dropoffLatitude: number;

  @Expose()
  @ApiProperty({ example: 31.2089 })
  dropoffLongitude: number;

  @Expose()
  @ApiProperty({ example: 'Giza Pyramids' })
  dropoffAddress: string;

  @Expose()
  @ApiProperty({ example: 85.5, description: 'EGP.' })
  proposedFare: number;

  @Expose()
  @ApiProperty({
    example: 90,
    nullable: true,
    description: 'EGP. The accepted offer’s amount.',
  })
  agreedFare: number | null;

  @Expose()
  @ApiProperty({ example: 'Mona Adel', nullable: true })
  recipientName: string | null;

  @Expose()
  @ApiProperty({ example: '+201001234567', nullable: true })
  recipientPhone: string | null;

  @Expose()
  @ApiProperty({ example: 'Small box, fragile', nullable: true })
  packageDescription: string | null;

  @Expose()
  @ApiProperty({
    example: '2026-10-11T08:10:00.000Z',
    description: 'When a REQUESTED trip stops accepting offers.',
  })
  expiresAt: Date;

  @Expose()
  @ApiProperty({ example: '2026-10-11T08:00:00.000Z' })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: '2026-10-11T08:00:00.000Z' })
  updatedAt: Date;
}

export default TripResponseDto;
