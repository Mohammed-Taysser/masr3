import {
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { dayjs } from '../../date/dayjs';
import {
  REFRESH_TOKEN_AUDIENCE,
  TOKEN_ISSUER,
  USER_TOKEN_AUDIENCE,
} from '../auth.constant';
import { TokenUseEnum } from '../auth.enum';
import type { KeyResolver } from '../auth.interface';
import TokenVerifierService from '../token-verifier.service';
import {
  createTestKey,
  forgeToken,
  refreshClaims,
  serviceClaims,
  signToken,
  TestKey,
  userClaims,
} from './token.fixture';

describe('TokenVerifierService', () => {
  let key: TestKey;
  let otherKey: TestKey;
  let keyResolver: jest.Mocked<KeyResolver>;
  let verifier: TokenVerifierService;

  beforeAll(() => {
    key = createTestKey('current-key');
    otherKey = createTestKey('other-key');
  });

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    keyResolver = {
      getPublicKey: jest.fn(async (keyId: string) => {
        if (keyId === key.keyId) {
          return key.publicPem;
        }

        throw new UnauthorizedException('Invalid access token');
      }),
    };
    verifier = new TokenVerifierService(new JwtService(), keyResolver);
  });

  afterEach(() => jest.restoreAllMocks());

  const verifyUser = (token: string) =>
    verifier.verify(token, TokenUseEnum.USER, USER_TOKEN_AUDIENCE);

  it('returns the claims of a valid access token', async () => {
    const payload = await verifyUser(
      signToken(key, userClaims(), { expiresIn: 300 }),
    );

    expect(payload).toMatchObject({
      sub: '7',
      tokenUse: TokenUseEnum.USER,
      iss: TOKEN_ISSUER,
      aud: USER_TOKEN_AUDIENCE,
    });
  });

  it('accepts refresh and service tokens for their own profile', async () => {
    await expect(
      verifier.verify(
        signToken(key, refreshClaims(), {
          audience: REFRESH_TOKEN_AUDIENCE,
          expiresIn: 300,
        }),
        TokenUseEnum.REFRESH,
        REFRESH_TOKEN_AUDIENCE,
      ),
    ).resolves.toMatchObject({ tokenUse: TokenUseEnum.REFRESH });

    await expect(
      verifier.verify(
        signToken(key, serviceClaims(), {
          audience: 'auth-service',
          expiresIn: 300,
        }),
        TokenUseEnum.SERVICE,
        'auth-service',
      ),
    ).resolves.toMatchObject({ sub: 'notification-service' });
  });

  describe('rejects with 401', () => {
    it.each([
      [
        'a bad signature',
        () =>
          signToken(otherKey, userClaims(), {
            keyId: 'current-key',
            expiresIn: 300,
          }),
      ],
      [
        'a wrong issuer',
        () => signToken(key, userClaims(), { issuer: 'evil', expiresIn: 300 }),
      ],
      [
        'a wrong audience',
        () =>
          signToken(key, userClaims(), { audience: 'trip', expiresIn: 300 }),
      ],
      [
        'an audience array containing the expected value',
        () =>
          signToken(key, userClaims(), {
            audience: [USER_TOKEN_AUDIENCE, 'other'],
            expiresIn: 300,
          }),
      ],
      [
        'missing iat and exp',
        () => signToken(key, userClaims(), { noTimestamp: true }),
      ],
      ['a missing exp', () => signToken(key, userClaims())],
      [
        'non-integer timestamps',
        () => signToken(key, userClaims({ exp: dayjs().unix() + 100.5 })),
      ],
      [
        'exp not after iat',
        () =>
          signToken(
            key,
            userClaims({
              iat: dayjs().unix() + 200,
              exp: dayjs().unix() + 100,
            }),
          ),
      ],
      [
        'an unknown kid',
        () => signToken(otherKey, userClaims(), { expiresIn: 300 }),
      ],
      [
        'alg none',
        () =>
          forgeToken(
            { alg: 'none', kid: 'current-key' },
            {
              ...userClaims(),
              iss: TOKEN_ISSUER,
              aud: USER_TOKEN_AUDIENCE,
              iat: dayjs().unix(),
              exp: dayjs().unix() + 300,
            },
          ),
      ],
      [
        'HS256 signed with the public PEM',
        () =>
          forgeToken(
            { alg: 'HS256', kid: 'current-key' },
            {
              ...userClaims(),
              iss: TOKEN_ISSUER,
              aud: USER_TOKEN_AUDIENCE,
              iat: dayjs().unix(),
              exp: dayjs().unix() + 300,
            },
            key.publicPem,
          ),
      ],
      ['garbage', () => 'not-a-jwt'],
    ])('%s', async (_case, buildToken) => {
      await expect(verifyUser(buildToken())).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('an expired token', async () => {
      const token = signToken(
        key,
        userClaims({
          iat: dayjs().unix() - 600,
          exp: dayjs().unix() - 60,
        }),
      );

      await expect(verifyUser(token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it.each([
      ['tokenUse', { tokenUse: TokenUseEnum.SERVICE }],
      ['a numeric sub', { sub: 7 }],
      ['an empty sub', { sub: '' }],
      ['a non-numeric sub', { sub: 'abc' }],
      ['a sub beyond MAX_SAFE_INTEGER', { sub: '9007199254740993' }],
      ['an unknown role', { role: 'ROOT' }],
      ['a negative tokenVersion', { tokenVersion: -1 }],
      ['a fractional tokenVersion', { tokenVersion: 1.5 }],
      ['a missing email', { email: undefined }],
    ])('an access token with a malformed %s', async (_case, overrides) => {
      const token = signToken(key, userClaims(overrides), { expiresIn: 300 });

      await expect(verifyUser(token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it.each([
      ['a sub beyond MAX_SAFE_INTEGER', { sub: '9007199254740993' }],
      ['a missing tokenVersion', { tokenVersion: undefined }],
      ['the access tokenUse', { tokenUse: TokenUseEnum.USER }],
    ])('a refresh token with %s', async (_case, overrides) => {
      const token = signToken(key, refreshClaims(overrides), {
        audience: REFRESH_TOKEN_AUDIENCE,
        expiresIn: 300,
      });

      await expect(
        verifier.verify(token, TokenUseEnum.REFRESH, REFRESH_TOKEN_AUDIENCE),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it.each([
      ['an empty sub', { sub: '' }],
      ['empty scopes', { scopes: [] }],
      ['an unknown scope', { scopes: ['ROOT'] }],
      ['scopes as a string', { scopes: 'USERS_CONTACT_READ' }],
    ])('a service token with %s', async (_case, overrides) => {
      const token = signToken(key, serviceClaims(overrides), {
        audience: 'auth-service',
        expiresIn: 300,
      });

      await expect(
        verifier.verify(token, TokenUseEnum.SERVICE, 'auth-service'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects before asking for a key when the header is wrong', async () => {
      await expect(
        verifyUser(forgeToken({ alg: 'HS256', kid: 'current-key' }, {})),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(keyResolver.getPublicKey).not.toHaveBeenCalled();
    });
  });

  it('passes a 503 from the key resolver through', async () => {
    keyResolver.getPublicKey.mockRejectedValue(
      new ServiceUnavailableException(),
    );

    await expect(
      verifyUser(signToken(key, userClaims(), { expiresIn: 300 })),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rethrows errors that are not JWT errors', async () => {
    const failure = new Error('boom');

    jest.spyOn(JwtService.prototype, 'verifyAsync').mockRejectedValue(failure);

    await expect(
      verifyUser(signToken(key, userClaims(), { expiresIn: 300 })),
    ).rejects.toBe(failure);
  });

  it('never logs the token', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const token = signToken(key, userClaims({ role: 'ROOT' }), {
      expiresIn: 300,
    });

    await expect(verifyUser(token)).rejects.toThrow();

    expect(warn).toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain(token);
  });
});
