import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import CreateTripOfferDto from '../../dto/create-trip-offer.dto';

const errorsFor = (amount: unknown) =>
  validateSync(plainToInstance(CreateTripOfferDto, { amount })).length;

describe('CreateTripOfferDto', () => {
  it.each([90, 90.5, 0.01])('accepts %p', (amount) => {
    expect(errorsFor(amount)).toBe(0);
  });

  it.each([0, -1, 90.555, '90', 100000000])('rejects %p', (amount) => {
    expect(errorsFor(amount)).toBeGreaterThan(0);
  });
});
