import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { VehicleTypeEnum } from '@masr3/libs/vehicle';

import UpdateRequestedVehicleTypeDto from '../../dto/update-requested-vehicle-type.dto';

const errorsFor = (plain: Record<string, unknown>) =>
  validateSync(plainToInstance(UpdateRequestedVehicleTypeDto, plain)).map(
    (error) => error.property,
  );

describe('UpdateRequestedVehicleTypeDto', () => {
  it.each([VehicleTypeEnum.CAR, null])('accepts %p', (requestedVehicleType) => {
    expect(errorsFor({ requestedVehicleType })).toEqual([]);
  });

  it.each([
    ['a missing key', {}],
    ['an unknown type', { requestedVehicleType: 'ROCKET' }],
  ])('rejects %s', (_case, plain) => {
    expect(errorsFor(plain)).toContain('requestedVehicleType');
  });
});
