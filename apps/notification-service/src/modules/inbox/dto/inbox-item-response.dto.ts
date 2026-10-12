import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

import {
  NotificationCategoryEnum,
  NotificationTypeEnum,
} from '../../notification/notification.enum';

class InboxItemResponseDto {
  @Expose()
  @ApiProperty({ example: 12 })
  id: number;

  @Expose()
  @ApiProperty({ enum: NotificationTypeEnum })
  type: NotificationTypeEnum;

  @Expose()
  @ApiProperty({ enum: NotificationCategoryEnum })
  category: NotificationCategoryEnum;

  @Expose()
  @ApiProperty({ example: 'Trip #42 completed' })
  title: string;

  @Expose()
  @ApiProperty({ example: 'You paid EGP 95.00. Thanks for riding with Masr3.' })
  body: string;

  @Expose()
  @ApiPropertyOptional({ example: 'masr3://trips/42', nullable: true })
  deepLink: string | null;

  @Expose()
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  readAt: Date | null;

  @Expose()
  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'When it reached the inbox.',
  })
  inboxAt: Date;
}

export default InboxItemResponseDto;
