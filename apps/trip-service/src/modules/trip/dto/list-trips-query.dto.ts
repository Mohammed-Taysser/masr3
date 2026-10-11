import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

import { TripStatusEnum } from '@masr3/libs';

class ListTripsQueryDto {
  @ApiPropertyOptional({
    enum: TripStatusEnum,
    description: 'Only trips in this status. Ignored by `GET /trips/open`.',
  })
  @IsOptional()
  @IsEnum(TripStatusEnum)
  status?: TripStatusEnum;

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
    description: 'Number of trips per page.',
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

export default ListTripsQueryDto;
