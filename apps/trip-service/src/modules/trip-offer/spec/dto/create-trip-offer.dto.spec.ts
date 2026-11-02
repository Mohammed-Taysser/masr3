import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import CreateTripOfferDto from '../../dto/create-trip-offer.dto';

const errorsFor = (amount: unknown, driverId?: unknown) =>
  validateSync(plainToInstance(CreateTripOfferDto, { amount, driverId }))
    .length;

describe('CreateTripOfferDto', () => {
  it.each([90, 90.5, 0.01])('accepts %p', (amount) => {
    expect(errorsFor(amount)).toBe(0);
  });

  it.each([0, -1, 90.555, '90', 100000000])('rejects %p', (amount) => {
    expect(errorsFor(amount)).toBeGreaterThan(0);
  });

  it('accepts a driverId', () => {
    expect(errorsFor(90, 5)).toBe(0);
  });

  it.each([0, -1, 1.5, '5'])('rejects driverId %p', (driverId) => {
    expect(errorsFor(90, driverId)).toBeGreaterThan(0);
  });
});
