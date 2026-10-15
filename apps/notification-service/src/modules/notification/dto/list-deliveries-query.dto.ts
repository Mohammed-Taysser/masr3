import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

import { PaginationQueryDto } from '@masr3/libs/pagination';

import {
  DeliveryStatusEnum,
  NotificationChannelEnum,
} from '../notification.enum';

class ListDeliveriesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: DeliveryStatusEnum,
    description:
      'Only deliveries in this status. FAILED is the dead-letter view.',
  })
  @IsOptional()
  @IsEnum(DeliveryStatusEnum)
  status?: DeliveryStatusEnum;

  @ApiPropertyOptional({
    enum: NotificationChannelEnum,
    description: 'Only this channel.',
  })
  @IsOptional()
  @IsEnum(NotificationChannelEnum)
  channel?: NotificationChannelEnum;

  @ApiPropertyOptional({
    type: Number,
    example: 2,
    description: "Only this user's deliveries.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId?: number;
}

export default ListDeliveriesQueryDto;
