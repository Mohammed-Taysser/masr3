import { randomBytes, randomInt } from 'crypto';

type CodeType = 'hex' | 'numeric' | 'alphanumeric';

const ALPHANUMERIC_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

// `length` is byte count for 'hex' (matches Node's randomBytes), character count for the others.
function generateCode(length = 32, type: CodeType = 'hex'): string {
  switch (type) {
    case 'numeric':
      return Array.from({ length }, () => randomInt(0, 10)).join('');
    case 'alphanumeric':
      return Array.from(
        { length },
        () => ALPHANUMERIC_CHARS[randomInt(0, ALPHANUMERIC_CHARS.length)],
      ).join('');
    case 'hex':
    default:
      return randomBytes(length).toString('hex');
  }
}

export { generateCode };
export type { CodeType };
