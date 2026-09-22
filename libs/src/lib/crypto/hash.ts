import { createHash } from 'crypto';

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export { sha256Hex };
