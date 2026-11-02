import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, ValidateIf } from 'class-validator';

import { VehicleTypeEnum } from '@masr3/libs/vehicle';

class UpdateRequestedVehicleTypeDto {
  @ApiProperty({
    enum: VehicleTypeEnum,
    nullable: true,
    example: VehicleTypeEnum.CAR,
    description: 'The vehicle type the trip needs; null accepts any type.',
  })
  @ValidateIf(
    (dto: UpdateRequestedVehicleTypeDto) => dto.requestedVehicleType !== null,
  )
  @IsEnum(VehicleTypeEnum)
  requestedVehicleType: VehicleTypeEnum | null;
}

export default UpdateRequestedVehicleTypeDto;
