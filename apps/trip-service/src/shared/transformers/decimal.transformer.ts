import { ValueTransformer } from 'typeorm';

// pg returns numeric/decimal columns as strings.
const decimalTransformer: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

export { decimalTransformer };
