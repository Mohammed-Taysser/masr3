import {
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';

import {
  JWKS_CACHE_TTL_MS,
  JWKS_FETCH_COOLDOWN_MS,
  JWKS_MAX_STALE_MS,
  USER_TOKEN_AUDIENCE,
} from '../auth.constant';
import { TokenUseEnum } from '../auth.enum';
import JwksKeyResolver from '../jwks-key.resolver';
import TokenVerifierService from '../token-verifier.service';
import { createTestKey, signToken, TestKey, userClaims } from './token.fixture';

const AUTH_SERVICE_URL = 'http://auth.test/api';
const JWKS_URL = `${AUTH_SERVICE_URL}/.well-known/jwks.json`;

describe('JwksKeyResolver', () => {
  let currentKey: TestKey;
  let previousKey: TestKey;
  let weakKey: TestKey;
  let get: jest.SpyInstance;
  let resolver: JwksKeyResolver;

  const respond = (data: unknown, status = 200) =>
    get.mockResolvedValueOnce({ status, data });
  const fail = () =>
    get.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
  const advance = (milliseconds: number) =>
    jest.setSystemTime(Date.now() + milliseconds);
  const document = (...keys: TestKey[]) => ({
    keys: keys.map((key) => key.jwk),
  });

  beforeAll(() => {
    currentKey = createTestKey('current-key');
    previousKey = createTestKey('previous-key');
    weakKey = createTestKey('weak-key', 1024);
  });

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-11T10:00:00Z') });
    get = jest.spyOn(axios, 'get');
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    resolver = new JwksKeyResolver({
      getOrThrow: () => AUTH_SERVICE_URL,
    } as unknown as ConfigService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('fetches only the configured URL, without following redirects', async () => {
    respond(document(currentKey));

    await expect(resolver.getPublicKey('current-key')).resolves.toBe(
      currentKey.publicPem,
    );
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(
      JWKS_URL,
      expect.objectContaining({ maxRedirects: 0 }),
    );
  });

  it('reuses a fresh set without fetching again', async () => {
    respond(document(currentKey));

    await resolver.getPublicKey('current-key');
    advance(JWKS_CACHE_TTL_MS - 1000);
    await resolver.getPublicKey('current-key');

    expect(get).toHaveBeenCalledTimes(1);
  });

  it('makes concurrent callers share one fetch', async () => {
    respond(document(currentKey));

    await Promise.all([
      resolver.getPublicKey('current-key'),
      resolver.getPublicKey('current-key'),
      resolver.getPublicKey('current-key'),
    ]);

    expect(get).toHaveBeenCalledTimes(1);
  });

  it('returns 401 when a successful fetch lacks the kid', async () => {
    respond(document(currentKey));

    await expect(resolver.getPublicKey('unknown-key')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('never uses another key for an unknown kid inside the cooldown', async () => {
    respond(document(currentKey));
    await resolver.getPublicKey('current-key');

    await expect(resolver.getPublicKey('unknown-key')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('refetches for an unknown kid once the cooldown has passed', async () => {
    respond(document(currentKey));
    await resolver.getPublicKey('current-key');

    advance(JWKS_FETCH_COOLDOWN_MS);
    respond(document(currentKey, previousKey));

    await expect(resolver.getPublicKey('previous-key')).resolves.toBe(
      previousKey.publicPem,
    );
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('drops keys that are no longer published', async () => {
    respond(document(currentKey, previousKey));
    await resolver.getPublicKey('previous-key');

    advance(JWKS_CACHE_TTL_MS);
    respond(document(currentKey));

    await expect(resolver.getPublicKey('previous-key')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('uses a cached key within max-stale when a refresh fails', async () => {
    respond(document(currentKey));
    await resolver.getPublicKey('current-key');

    advance(JWKS_CACHE_TTL_MS);
    fail();

    await expect(resolver.getPublicKey('current-key')).resolves.toBe(
      currentKey.publicPem,
    );
  });

  it('fails closed with 503 once the cached set is older than max-stale', async () => {
    respond(document(currentKey));
    await resolver.getPublicKey('current-key');

    advance(JWKS_MAX_STALE_MS);
    fail();

    await expect(resolver.getPublicKey('current-key')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('returns 503 when there is no cache and auth-service is down', async () => {
    fail();

    await expect(resolver.getPublicKey('current-key')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('records a failed attempt as failed even with an older set cached', async () => {
    respond(document(currentKey));
    await resolver.getPublicKey('current-key');

    advance(JWKS_CACHE_TTL_MS);
    fail();
    await resolver.getPublicKey('current-key');

    // Inside the cooldown after a failure, an unknown kid is unavailable, not
    // invalid.
    await expect(resolver.getPublicKey('unknown-key')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('does not hammer auth-service while it is failing', async () => {
    fail();
    await expect(resolver.getPublicKey('current-key')).rejects.toThrow();
    await expect(resolver.getPublicKey('current-key')).rejects.toThrow();

    expect(get).toHaveBeenCalledTimes(1);
  });

  it('treats a non-200 response as a failed fetch', async () => {
    respond({ message: 'down' }, 500);

    await expect(resolver.getPublicKey('current-key')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  describe('document policy', () => {
    it.each([
      ['a malformed document', { not: 'keys' }],
      ['keys that is not an array', { keys: 'nope' }],
      ['zero usable keys', { keys: [] }],
    ])('rejects %s', async (_case, body) => {
      respond(body);

      await expect(resolver.getPublicKey('current-key')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('rejects the whole document when any key carries private material', async () => {
      const privateJwk = {
        ...currentKey.privateKey.export({ format: 'jwk' }),
        kid: 'leaked-key',
      };

      respond({ keys: [currentKey.jwk, privateJwk] });

      await expect(resolver.getPublicKey('current-key')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('rejects the whole document when two keys share a kid', async () => {
      respond({
        keys: [currentKey.jwk, { ...previousKey.jwk, kid: 'current-key' }],
      });

      await expect(resolver.getPublicKey('current-key')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('ignores single unusable keys and keeps the usable ones', async () => {
      respond({
        keys: [
          { ...previousKey.jwk, kty: 'EC' },
          { ...previousKey.jwk, kid: undefined },
          { ...previousKey.jwk, kid: 'enc-key', use: 'enc' },
          { ...previousKey.jwk, kid: 'hs-key', alg: 'HS256' },
          weakKey.jwk,
          currentKey.jwk,
        ],
      });

      await expect(resolver.getPublicKey('current-key')).resolves.toBe(
        currentKey.publicPem,
      );
      await expect(resolver.getPublicKey('weak-key')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      await expect(resolver.getPublicKey('enc-key')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('keeps the last usable set after a malformed response, then replaces it', async () => {
      respond(document(currentKey));
      await resolver.getPublicKey('current-key');

      advance(JWKS_CACHE_TTL_MS);
      respond({ keys: 'broken' });
      await expect(resolver.getPublicKey('current-key')).resolves.toBe(
        currentKey.publicPem,
      );

      advance(JWKS_FETCH_COOLDOWN_MS);
      respond(document(previousKey));
      await expect(resolver.getPublicKey('previous-key')).resolves.toBe(
        previousKey.publicPem,
      );
      await expect(resolver.getPublicKey('current-key')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  it('never fetches a URL named by the token header', async () => {
    respond(document(currentKey));
    const verifier = new TokenVerifierService(new JwtService(), resolver);
    const token = new JwtService().sign(userClaims(), {
      algorithm: 'RS256',
      privateKey: currentKey.privateKey,
      keyid: 'current-key',
      issuer: 'auth-service',
      audience: USER_TOKEN_AUDIENCE,
      expiresIn: 300,
      header: { alg: 'RS256', jku: 'http://evil.test/jwks.json' } as never,
    });

    await verifier.verify(token, TokenUseEnum.USER, USER_TOKEN_AUDIENCE);

    expect(get.mock.calls.map(([url]) => url)).toEqual([JWKS_URL]);
  });

  it('rotates access-token keys through the published set', async () => {
    const verifier = new TokenVerifierService(new JwtService(), resolver);
    const oldToken = signToken(previousKey, userClaims(), { expiresIn: 3600 });

    respond(document(currentKey, previousKey));
    await expect(
      verifier.verify(oldToken, TokenUseEnum.USER, USER_TOKEN_AUDIENCE),
    ).resolves.toMatchObject({ sub: '7' });

    advance(JWKS_CACHE_TTL_MS);
    respond(document(currentKey));
    await expect(
      verifier.verify(oldToken, TokenUseEnum.USER, USER_TOKEN_AUDIENCE),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
