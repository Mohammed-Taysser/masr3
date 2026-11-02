import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { VehicleVerificationStatusEnum } from '@masr3/libs/vehicle';
import { trim } from '../../../shared/transformers/text.transformer';
import { VEHICLE_STATUS_REASON_MAX_LENGTH } from '../vehicle.constant';

class UpdateVerificationStatusDto {
  @ApiProperty({
    enum: VehicleVerificationStatusEnum,
    example: VehicleVerificationStatusEnum.APPROVED,
  })
  @IsEnum(VehicleVerificationStatusEnum)
  status: VehicleVerificationStatusEnum;

  @ApiPropertyOptional({
    example: 'Registration papers checked',
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

export default UpdateVerificationStatusDto;
