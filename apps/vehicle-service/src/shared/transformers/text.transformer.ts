import { TransformFnParams } from 'class-transformer';

// Leaves non-strings alone so the validator still reports them.
function trim(params: TransformFnParams): unknown {
  return typeof params.value === 'string' ? params.value.trim() : params.value;
}

// "abc  123 " → "ABC 123": one spelling per plate, so the unique index holds.
function toPlateNumber(params: TransformFnParams): unknown {
  return typeof params.value === 'string'
    ? params.value.trim().replace(/\s+/g, ' ').toUpperCase()
    : params.value;
}

export { toPlateNumber, trim };
