import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

import { TripActorEnum, TripStatusEnum } from '@masr3/libs/kafka';

class TripHistoryResponseDto {
  @Expose()
  @ApiProperty({ example: 31 })
  id: number;

  @Expose()
  @ApiProperty({ example: 7 })
  tripId: number;

  @Expose()
  @ApiProperty({
    enum: TripStatusEnum,
    example: TripStatusEnum.REQUESTED,
    nullable: true,
    description: 'Null on the row that records the trip’s creation.',
  })
  fromStatus: TripStatusEnum | null;

  @Expose()
  @ApiProperty({ enum: TripStatusEnum, example: TripStatusEnum.ACCEPTED })
  toStatus: TripStatusEnum;

  @Expose()
  @ApiProperty({ enum: TripActorEnum, example: TripActorEnum.CUSTOMER })
  actor: TripActorEnum;

  @Expose()
  @ApiProperty({ example: 2, nullable: true, description: 'Null for SYSTEM.' })
  actorId: number | null;

  @Expose()
  @ApiProperty({ example: null, nullable: true })
  reason: string | null;

  @Expose()
  @ApiProperty({ example: '2026-10-11T08:02:00.000Z' })
  createdAt: Date;
}

export default TripHistoryResponseDto;
