import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

import {
  VehicleOperationalStatusEnum,
  VehicleTypeEnum,
  VehicleVerificationStatusEnum,
} from '../vehicle.enum';
import DriverSummaryResponseDto from './driver-summary-response.dto';

class VehicleResponseDto {
  @Expose()
  @ApiProperty({ example: 12 })
  id: number;

  @Expose()
  @ApiProperty({ example: 5, description: 'auth-service user id.' })
  driverId: number;

  @Expose()
  @Type(() => DriverSummaryResponseDto)
  @ApiProperty({
    type: DriverSummaryResponseDto,
    nullable: true,
    description:
      'Null until auth-service has published the driver, or once the user is no longer a driver.',
  })
  driver: DriverSummaryResponseDto | null;

  @Expose()
  @ApiProperty({ enum: VehicleTypeEnum, example: VehicleTypeEnum.CAR })
  type: VehicleTypeEnum;

  @Expose()
  @ApiProperty({ example: 'Toyota' })
  manufacturer: string;

  @Expose()
  @ApiProperty({ example: 'Corolla' })
  model: string;

  @Expose()
  @ApiProperty({ example: 2022 })
  year: number;

  @Expose()
  @ApiProperty({ example: 'ABC 1234' })
  plateNumber: string;

  @Expose()
  @ApiProperty({ example: 'White', nullable: true })
  color: string | null;

  @Expose()
  @ApiProperty({
    enum: VehicleVerificationStatusEnum,
    example: VehicleVerificationStatusEnum.PENDING,
  })
  verificationStatus: VehicleVerificationStatusEnum;

  @Expose()
  @ApiProperty({
    enum: VehicleOperationalStatusEnum,
    example: VehicleOperationalStatusEnum.INACTIVE,
  })
  operationalStatus: VehicleOperationalStatusEnum;

  @Expose()
  @ApiProperty({ example: true })
  isDefault: boolean;

  @Expose()
  @ApiProperty({ example: '2026-10-15T08:00:00.000Z' })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: '2026-10-15T08:00:00.000Z' })
  updatedAt: Date;
}

export default VehicleResponseDto;
