import { JwtService } from '@nestjs/jwt';
import {
  createHmac,
  createPublicKey,
  generateKeyPairSync,
  KeyObject,
} from 'node:crypto';

import {
  JWT_ALGORITHM,
  TOKEN_ISSUER,
  USER_TOKEN_AUDIENCE,
} from '../auth.constant';
import { ServiceScopeEnum, TokenUseEnum, UserRoleEnum } from '../auth.enum';

interface TestKey {
  keyId: string;
  privateKey: KeyObject;
  publicPem: string;
  jwk: Record<string, unknown>;
}

interface SignOptions {
  audience?: string | string[];
  issuer?: string;
  expiresIn?: number;
  keyId?: string;
  noTimestamp?: boolean;
}

const jwtService = new JwtService();

function createTestKey(keyId: string, modulusLength = 2048): TestKey {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength });
  const publicKey = createPublicKey(privateKey);

  return {
    keyId,
    privateKey,
    publicPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    jwk: {
      ...publicKey.export({ format: 'jwk' }),
      kid: keyId,
      use: 'sig',
      alg: JWT_ALGORITHM,
    },
  };
}

function signToken(
  key: TestKey,
  claims: Record<string, unknown>,
  options: SignOptions = {},
): string {
  return jwtService.sign(claims, {
    algorithm: JWT_ALGORITHM,
    privateKey: key.privateKey,
    keyid: options.keyId ?? key.keyId,
    issuer: options.issuer ?? TOKEN_ISSUER,
    audience: options.audience ?? USER_TOKEN_AUDIENCE,
    noTimestamp: options.noTimestamp ?? false,
    ...(options.expiresIn === undefined
      ? {}
      : { expiresIn: options.expiresIn }),
  });
}

function encodeSegment(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

// Builds a token by hand, for headers and signatures jsonwebtoken refuses to
// produce (alg none, HMAC keyed with the public PEM).
function forgeToken(
  header: Record<string, unknown>,
  claims: Record<string, unknown>,
  hmacSecret?: string,
): string {
  const unsigned = `${encodeSegment(header)}.${encodeSegment(claims)}`;
  const signature = hmacSecret
    ? createHmac('sha256', hmacSecret).update(unsigned).digest('base64url')
    : '';

  return `${unsigned}.${signature}`;
}

function userClaims(overrides: Record<string, unknown> = {}) {
  return {
    sub: '7',
    tokenUse: TokenUseEnum.USER,
    role: UserRoleEnum.CUSTOMER,
    tokenVersion: 0,
    email: 'customer@masr3.local',
    ...overrides,
  };
}

function refreshClaims(overrides: Record<string, unknown> = {}) {
  return {
    sub: '7',
    tokenUse: TokenUseEnum.REFRESH,
    tokenVersion: 0,
    ...overrides,
  };
}

function serviceClaims(overrides: Record<string, unknown> = {}) {
  return {
    sub: 'notification-service',
    tokenUse: TokenUseEnum.SERVICE,
    scopes: [ServiceScopeEnum.USERS_CONTACT_READ],
    ...overrides,
  };
}

export {
  createTestKey,
  forgeToken,
  refreshClaims,
  serviceClaims,
  signToken,
  userClaims,
};
export type { TestKey };
