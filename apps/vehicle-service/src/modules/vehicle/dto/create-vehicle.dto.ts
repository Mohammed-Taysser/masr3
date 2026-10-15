import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { dayjs } from '@masr3/libs/date';

import {
  toPlateNumber,
  trim,
} from '../../../shared/transformers/text.transformer';
import {
  VEHICLE_COLOR_MAX_LENGTH,
  VEHICLE_MINIMUM_YEAR,
  VEHICLE_NAME_MAX_LENGTH,
  VEHICLE_PLATE_NUMBER_MAX_LENGTH,
} from '../vehicle.constant';
import { VehicleTypeEnum } from '../vehicle.enum';

// No status fields: a new vehicle is PENDING and INACTIVE, and only an admin
// changes either, through its own endpoint.
class CreateVehicleDto {
  @ApiPropertyOptional({
    example: 5,
    description:
      'The driver (auth user id) who owns the vehicle. Required for an admin; a driver omits it.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  driverId?: number;

  @ApiProperty({ enum: VehicleTypeEnum, example: VehicleTypeEnum.CAR })
  @IsEnum(VehicleTypeEnum)
  type: VehicleTypeEnum;

  @ApiProperty({ example: 'Toyota', maxLength: VEHICLE_NAME_MAX_LENGTH })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(VEHICLE_NAME_MAX_LENGTH)
  manufacturer: string;

  @ApiProperty({ example: 'Corolla', maxLength: VEHICLE_NAME_MAX_LENGTH })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(VEHICLE_NAME_MAX_LENGTH)
  model: string;

  // The upper bound is read when the app starts, so next year's models are
  // accepted from today.
  @ApiProperty({ example: 2022, minimum: VEHICLE_MINIMUM_YEAR })
  @IsInt()
  @Min(VEHICLE_MINIMUM_YEAR)
  @Max(dayjs().year() + 1)
  year: number;

  @ApiProperty({
    example: 'ABC 1234',
    maxLength: VEHICLE_PLATE_NUMBER_MAX_LENGTH,
    description: 'Trimmed and upper-cased. Unique across all vehicles.',
  })
  @Transform(toPlateNumber)
  @IsString()
  @IsNotEmpty()
  @MaxLength(VEHICLE_PLATE_NUMBER_MAX_LENGTH)
  plateNumber: string;

  @ApiPropertyOptional({
    example: 'White',
    nullable: true,
    maxLength: VEHICLE_COLOR_MAX_LENGTH,
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(VEHICLE_COLOR_MAX_LENGTH)
  color?: string | null;

  @ApiPropertyOptional({
    example: true,
    default: false,
    description:
      "The driver's default vehicle. Setting it clears the driver's previous default.",
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export default CreateVehicleDto;
