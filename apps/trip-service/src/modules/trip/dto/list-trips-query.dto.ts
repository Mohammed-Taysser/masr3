import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

import { TripStatusEnum } from '@masr3/libs/kafka';
import { PaginationQueryDto } from '@masr3/libs/pagination';

class ListTripsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: TripStatusEnum,
    description: 'Only trips in this status. Ignored by `GET /trips/open`.',
  })
  @IsOptional()
  @IsEnum(TripStatusEnum)
  status?: TripStatusEnum;
}

export default ListTripsQueryDto;
