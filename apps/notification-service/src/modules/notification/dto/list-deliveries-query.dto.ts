import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

import {
  DeliveryStatusEnum,
  NotificationChannelEnum,
} from '../notification.enum';

class ListDeliveriesQueryDto {
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

  @ApiPropertyOptional({
    type: Number,
    description: 'Page number.',
    example: 1,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({
    type: Number,
    description: 'Deliveries per page.',
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export default ListDeliveriesQueryDto;
