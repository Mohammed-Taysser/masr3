import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { MONEY_MAX } from '../money.constant';
import { IsMoney } from '../money.decorator';

class ExampleDto {
  @IsMoney()
  amount!: number;
}

const isValid = (amount: unknown) =>
  validateSync(plainToInstance(ExampleDto, { amount })).length === 0;

describe('IsMoney', () => {
  it.each([0.01, 85.5, 90, MONEY_MAX])('accepts %p', (amount) => {
    expect(isValid(amount)).toBe(true);
  });

  it.each([0, -5, 10.555, MONEY_MAX + 1, '90', null])(
    'rejects %p',
    (amount) => {
      expect(isValid(amount)).toBe(false);
    },
  );
});
