import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { dayjs } from '@masr3/libs/date';

import CreateVehicleDto from '../../dto/create-vehicle.dto';
import UpdateVehicleDto from '../../dto/update-vehicle.dto';
import { VehicleTypeEnum } from '../../vehicle.enum';

const valid = {
  type: VehicleTypeEnum.CAR,
  manufacturer: 'Toyota',
  model: 'Corolla',
  year: 2022,
  plateNumber: 'ABC 1234',
};

const errorsFor = (plain: Record<string, unknown>) =>
  validateSync(plainToInstance(CreateVehicleDto, plain)).map(
    (error) => error.property,
  );

describe('CreateVehicleDto', () => {
  it('accepts a minimal vehicle', () => {
    expect(errorsFor(valid)).toEqual([]);
  });

  it('normalises the plate number', () => {
    const dto = plainToInstance(CreateVehicleDto, {
      ...valid,
      plateNumber: '  abc   1234 ',
    });

    expect(dto.plateNumber).toBe('ABC 1234');
  });

  it('trims the manufacturer and model', () => {
    const dto = plainToInstance(CreateVehicleDto, {
      ...valid,
      manufacturer: ' Toyota ',
      model: ' Corolla ',
    });

    expect(dto.manufacturer).toBe('Toyota');
    expect(dto.model).toBe('Corolla');
  });

  it('accepts next year’s model', () => {
    expect(errorsFor({ ...valid, year: dayjs().year() + 1 })).toEqual([]);
  });

  it.each([
    ['type', 'SPACESHIP'],
    ['manufacturer', '   '],
    ['model', ''],
    ['year', 1979],
    ['year', dayjs().year() + 2],
    ['year', 2022.5],
    ['plateNumber', ''],
    ['plateNumber', 'X'.repeat(21)],
    ['color', ''],
    ['isDefault', 'yes'],
    ['driverId', 0],
  ])('rejects %s = %p', (property, value) => {
    expect(errorsFor({ ...valid, [property]: value })).toContain(property);
  });
});

describe('UpdateVehicleDto', () => {
  it('accepts an empty body', () => {
    expect(validateSync(plainToInstance(UpdateVehicleDto, {}))).toEqual([]);
  });

  it('has no driverId or status fields', () => {
    const dto = plainToInstance(UpdateVehicleDto, {
      driverId: 6,
      verificationStatus: 'APPROVED',
    });

    expect(
      validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).map(
        (error) => error.property,
      ),
    ).toEqual(['driverId', 'verificationStatus']);
  });
});
