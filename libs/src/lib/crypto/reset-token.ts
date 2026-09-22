import { generateCode } from './code-generator';
import { sha256Hex } from './hash';

interface ResetToken {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
}

function createResetToken(ttlMs: number): ResetToken {
  const rawToken = generateCode();
  const tokenHash = sha256Hex(rawToken);
  const expiresAt = new Date(Date.now() + ttlMs);

  return { rawToken, tokenHash, expiresAt };
}

export { createResetToken };
export type { ResetToken };
