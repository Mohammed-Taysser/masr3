import { OmitType, PartialType } from '@nestjs/swagger';

import CreateVehicleDto from './create-vehicle.dto';

// A vehicle never changes owner, and its statuses have their own endpoints.
class UpdateVehicleDto extends PartialType(
  OmitType(CreateVehicleDto, ['driverId'] as const),
) {}

export default UpdateVehicleDto;
