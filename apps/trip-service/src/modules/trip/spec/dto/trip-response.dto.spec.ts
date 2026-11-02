import { plainToInstance } from 'class-transformer';

import { VehicleTypeEnum } from '@masr3/libs/vehicle';

import TripResponseDto from '../../dto/trip-response.dto';

// The global serializer runs with excludeExtraneousValues: a field without
// @Expose() silently disappears from every response.
const serialize = (plain: Record<string, unknown>) =>
  plainToInstance(TripResponseDto, plain, { excludeExtraneousValues: true });

describe('TripResponseDto', () => {
  it.each([VehicleTypeEnum.CAR, null])(
    'exposes requestedVehicleType %p',
    (requestedVehicleType) => {
      expect(serialize({ id: 7, requestedVehicleType })).toMatchObject({
        id: 7,
        requestedVehicleType,
      });
    },
  );

  it('drops fields it does not declare', () => {
    expect(serialize({ id: 7, internalNote: 'x' })).not.toHaveProperty(
      'internalNote',
    );
  });
});
