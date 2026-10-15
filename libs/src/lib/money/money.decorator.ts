import { applyDecorators } from '@nestjs/common';
import { IsNumber, IsPositive, Max } from 'class-validator';

import { MONEY_MAX, MONEY_SCALE } from './money.constant';

// A positive amount that fits a money column: at most MONEY_SCALE decimals
// and MONEY_MAX.
const IsMoney = () =>
  applyDecorators(
    IsNumber({ maxDecimalPlaces: MONEY_SCALE }),
    IsPositive(),
    Max(MONEY_MAX),
  );

export { IsMoney };
