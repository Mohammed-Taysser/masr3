import { createHash } from 'crypto';
import { sha256Hex } from './hash';

describe('sha256Hex', () => {
  it('returns the hex-encoded sha256 digest of the input', () => {
    const expected = createHash('sha256').update('raw-token').digest('hex');

    expect(sha256Hex('raw-token')).toBe(expected);
  });

  it('returns different digests for different inputs', () => {
    expect(sha256Hex('a')).not.toBe(sha256Hex('b'));
  });
});
