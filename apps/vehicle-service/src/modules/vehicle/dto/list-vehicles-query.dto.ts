import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

import { PaginationQueryDto } from '@masr3/libs/pagination';

import { trim } from '../../../shared/transformers/text.transformer';
import {
  VehicleOperationalStatusEnum,
  VehicleTypeEnum,
  VehicleVerificationStatusEnum,
} from '../vehicle.enum';

class ListVehiclesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: 'toyota',
    description:
      'Matches the plate number, manufacturer, model, or the driver’s first or last name.',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  search?: string;

  @ApiPropertyOptional({
    type: Number,
    example: 5,
    description: "Only this driver's vehicles. Ignored by `GET /vehicles/me`.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  driverId?: number;

  @ApiPropertyOptional({ enum: VehicleTypeEnum })
  @IsOptional()
  @IsEnum(VehicleTypeEnum)
  type?: VehicleTypeEnum;

  @ApiPropertyOptional({ enum: VehicleVerificationStatusEnum })
  @IsOptional()
  @IsEnum(VehicleVerificationStatusEnum)
  verificationStatus?: VehicleVerificationStatusEnum;

  @ApiPropertyOptional({ enum: VehicleOperationalStatusEnum })
  @IsOptional()
  @IsEnum(VehicleOperationalStatusEnum)
  operationalStatus?: VehicleOperationalStatusEnum;
}

export default ListVehiclesQueryDto;
