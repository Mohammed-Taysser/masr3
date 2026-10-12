import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

import { toBoolean } from '../../../shared/transformers/to-boolean.transformer';
import { NotificationCategoryEnum } from '../../notification/notification.enum';

class ListInboxQueryDto {
  @ApiPropertyOptional({
    type: Boolean,
    description: 'true for unread items only.',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  unread?: boolean;

  @ApiPropertyOptional({
    enum: NotificationCategoryEnum,
    description: 'Only this category.',
  })
  @IsOptional()
  @IsEnum(NotificationCategoryEnum)
  category?: NotificationCategoryEnum;

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
    description: 'Items per page.',
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

export default ListInboxQueryDto;
