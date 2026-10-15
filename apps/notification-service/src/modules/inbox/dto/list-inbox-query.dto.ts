import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '@masr3/libs/pagination';

import { toBoolean } from '../../../shared/transformers/to-boolean.transformer';
import { NotificationCategoryEnum } from '../../notification/notification.enum';

class ListInboxQueryDto extends PaginationQueryDto {
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
}

export default ListInboxQueryDto;
