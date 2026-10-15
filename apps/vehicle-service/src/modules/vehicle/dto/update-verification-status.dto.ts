import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { trim } from '../../../shared/transformers/text.transformer';
import { VEHICLE_STATUS_REASON_MAX_LENGTH } from '../vehicle.constant';
import { VehicleVerificationStatusEnum } from '../vehicle.enum';

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
