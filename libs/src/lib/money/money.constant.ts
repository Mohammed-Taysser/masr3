import { ColumnOptions } from 'typeorm';

import { decimalTransformer } from '../database/decimal.transformer';

// Money is decimal(10, 2) in the currency's major unit (EGP): up to
// 99,999,999.99, never a float column.
const MONEY_PRECISION = 10;
const MONEY_SCALE = 2;
const MONEY_MAX = 99999999.99;

// `@Column({ ...MONEY_COLUMN_OPTIONS })`; add `nullable: true` where needed.
const MONEY_COLUMN_OPTIONS: ColumnOptions = {
  type: 'decimal',
  precision: MONEY_PRECISION,
  scale: MONEY_SCALE,
  transformer: decimalTransformer,
};

export { MONEY_COLUMN_OPTIONS, MONEY_MAX, MONEY_PRECISION, MONEY_SCALE };
