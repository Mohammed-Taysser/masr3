import { sha256Hex } from './hash';
import { createResetToken } from './reset-token';

describe('createResetToken', () => {
  it('returns a raw token whose hash matches tokenHash', () => {
    const { rawToken, tokenHash } = createResetToken(60_000);

    expect(tokenHash).toBe(sha256Hex(rawToken));
  });

  it('sets expiresAt to now + ttlMs', () => {
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);

    const { expiresAt } = createResetToken(60_000);

    expect(expiresAt.getTime()).toBe(now + 60_000);

    jest.restoreAllMocks();
  });
});
