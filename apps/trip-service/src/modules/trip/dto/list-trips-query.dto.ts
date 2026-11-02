import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

import { TripStatusEnum, TripTypeEnum } from '@masr3/libs/kafka';
import { PaginationQueryDto } from '@masr3/libs/pagination';
import { VehicleTypeEnum } from '@masr3/libs/vehicle';

class ListTripsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: TripStatusEnum,
    description: 'Only trips in this status. Ignored by `GET /trips/open`.',
  })
  @IsOptional()
  @IsEnum(TripStatusEnum)
  status?: TripStatusEnum;

  @ApiPropertyOptional({ enum: TripTypeEnum })
  @IsOptional()
  @IsEnum(TripTypeEnum)
  type?: TripTypeEnum;

  @ApiPropertyOptional({ enum: VehicleTypeEnum, example: VehicleTypeEnum.CAR })
  @IsOptional()
  @IsEnum(VehicleTypeEnum)
  requestedVehicleType?: VehicleTypeEnum;

  @ApiPropertyOptional({
    type: Number,
    example: 3,
    description:
      "Only this customer's trips. Ignored by `GET /trips/me` for a customer.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customerId?: number;

  @ApiPropertyOptional({
    type: Number,
    example: 5,
    description:
      'Only trips assigned to this driver. Ignored by `GET /trips/me` for a driver.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  driverId?: number;
}

export default ListTripsQueryDto;
