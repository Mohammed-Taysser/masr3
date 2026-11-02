import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { VehicleOperationalStatusEnum } from '@masr3/libs/vehicle';
import { trim } from '../../../shared/transformers/text.transformer';
import { VEHICLE_STATUS_REASON_MAX_LENGTH } from '../vehicle.constant';

class UpdateOperationalStatusDto {
  @ApiProperty({
    enum: VehicleOperationalStatusEnum,
    example: VehicleOperationalStatusEnum.ACTIVE,
  })
  @IsEnum(VehicleOperationalStatusEnum)
  status: VehicleOperationalStatusEnum;

  @ApiPropertyOptional({
    example: 'Insurance expired',
    maxLength: VEHICLE_STATUS_REASON_MAX_LENGTH,
    description: 'Kept in the audit entry for this change.',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(VEHICLE_STATUS_REASON_MAX_LENGTH)
  reason?: string;
}

export default UpdateOperationalStatusDto;
