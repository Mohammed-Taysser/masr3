import { TransformFnParams } from 'class-transformer';

/**
 * Use as `@Transform(toBoolean)`. Accepts 'true' / 'false' in any case; any
 * other value is returned as-is so `@IsBoolean()` can reject it.
 *
 * `enableImplicitConversion` coerces with `Boolean()`, so the string 'false'
 * becomes `true`. This reads the raw value off `obj`, because by the time the
 * transform runs `value` has already been coerced.
 */
function toBoolean({
  obj,
  key,
}: Pick<TransformFnParams, 'obj' | 'key'>): unknown {
  const raw = obj?.[key];

  if (typeof raw !== 'string') {
    return raw;
  }

  const normalized = raw.trim().toLowerCase();

  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  return raw;
}

export { toBoolean };
