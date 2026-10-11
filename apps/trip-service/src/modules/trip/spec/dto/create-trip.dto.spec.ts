import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { TripTypeEnum } from '@masr3/libs';

import CreateTripDto from '../../dto/create-trip.dto';

const ride = {
  type: TripTypeEnum.RIDE,
  pickupLatitude: 30.04442,
  pickupLongitude: 31.235712,
  pickupAddress: 'Tahrir Square',
  dropoffLatitude: 30.0131,
  dropoffLongitude: 31.2089,
  dropoffAddress: 'Giza',
  proposedFare: 85.5,
};

const errorsFor = (plain: Record<string, unknown>) =>
  validateSync(plainToInstance(CreateTripDto, plain)).map(
    (error) => error.property,
  );

describe('CreateTripDto', () => {
  it('accepts a valid ride without parcel fields', () => {
    expect(errorsFor(ride)).toEqual([]);
  });

  it.each([
    ['pickupLatitude', 91],
    ['pickupLatitude', -91],
    ['pickupLongitude', 181],
    ['dropoffLongitude', -181],
  ])('rejects %s = %p', (property, value) => {
    expect(errorsFor({ ...ride, [property]: value })).toContain(property);
  });

  it.each([0, -5, 10.555, 100000000])('rejects proposedFare %p', (fare) => {
    expect(errorsFor({ ...ride, proposedFare: fare })).toContain(
      'proposedFare',
    );
  });

  it('rejects an empty address', () => {
    expect(errorsFor({ ...ride, pickupAddress: '' })).toContain(
      'pickupAddress',
    );
  });

  it('requires a recipient for a parcel', () => {
    expect(errorsFor({ ...ride, type: TripTypeEnum.PARCEL })).toEqual(
      expect.arrayContaining(['recipientName', 'recipientPhone']),
    );
  });

  it('accepts a parcel with an Egyptian recipient phone', () => {
    expect(
      errorsFor({
        ...ride,
        type: TripTypeEnum.PARCEL,
        recipientName: 'Mona Adel',
        recipientPhone: '+201001234567',
      }),
    ).toEqual([]);
  });

  it('rejects a recipient phone that is not Egyptian', () => {
    expect(
      errorsFor({
        ...ride,
        type: TripTypeEnum.PARCEL,
        recipientName: 'Mona Adel',
        recipientPhone: '+14155550123',
      }),
    ).toContain('recipientPhone');
  });
});
