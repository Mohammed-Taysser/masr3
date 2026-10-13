import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

import {
  DeliverySkipReasonEnum,
  DeliveryStatusEnum,
  NotificationChannelEnum,
  NotificationTypeEnum,
} from '../notification.enum';
import NotificationDeliveryEntity from '../entities/notification-delivery.entity';

class DeliveryResponseDto {
  @Expose()
  @ApiProperty({ example: 31 })
  id: number;

  @Expose()
  @ApiProperty({ example: 12 })
  notificationId: number;

  @Expose()
  @Transform(
    (params) => (params.obj as NotificationDeliveryEntity).notification?.type,
  )
  @ApiProperty({ enum: NotificationTypeEnum })
  type: NotificationTypeEnum;

  @Expose()
  @Transform(
    (params) => (params.obj as NotificationDeliveryEntity).notification?.userId,
  )
  @ApiProperty({ example: 2 })
  userId: number;

  @Expose()
  @ApiProperty({ enum: NotificationChannelEnum })
  channel: NotificationChannelEnum;

  @Expose()
  @ApiPropertyOptional({ example: 'customer@masr3.local', nullable: true })
  address: string | null;

  @Expose()
  @ApiProperty({ enum: DeliveryStatusEnum })
  status: DeliveryStatusEnum;

  @Expose()
  @ApiPropertyOptional({ enum: DeliverySkipReasonEnum, nullable: true })
  skipReason: DeliverySkipReasonEnum | null;

  @Expose()
  @ApiProperty({ example: 1 })
  attempts: number;

  @Expose()
  @ApiPropertyOptional({ example: 'Your trip receipt', nullable: true })
  subject: string | null;

  @Expose()
  @ApiPropertyOptional({
    example: 'connect ECONNREFUSED 127.0.0.1:45000',
    nullable: true,
  })
  lastError: string | null;

  @Expose()
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  sentAt: Date | null;

  @Expose()
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

export default DeliveryResponseDto;
