import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

import { SERVICE_TOKEN_REFRESH_MARGIN_MS } from '../auth.constant';
import { ServiceScopeEnum } from '../auth.enum';
import ServiceTokenProvider from '../service-token.provider';

const SECRET = 'a'.repeat(64);
const CONFIG: Record<string, string> = {
  AUTH_SERVICE_URL: 'http://auth.test/api',
  SERVICE_NAME: 'notification-service',
  SERVICE_CLIENT_SECRET: SECRET,
};
const SCOPES = [ServiceScopeEnum.USERS_CONTACT_READ];

describe('ServiceTokenProvider', () => {
  let post: jest.SpyInstance;
  let error: jest.SpyInstance;
  let provider: ServiceTokenProvider;
  let issued = 0;

  const grant = (expiresIn = 300) =>
    post.mockImplementationOnce(async () => {
      issued += 1;

      return {
        status: 200,
        data: {
          accessToken: `token-${issued}`,
          tokenType: 'Bearer',
          expiresIn,
        },
      };
    });
  const advance = (milliseconds: number) =>
    jest.setSystemTime(Date.now() + milliseconds);

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-11T10:00:00Z') });
    issued = 0;
    post = jest.spyOn(axios, 'post');
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    provider = new ServiceTokenProvider({
      getOrThrow: (key: string) => CONFIG[key],
    } as unknown as ConfigService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('requests a token with Basic client credentials', async () => {
    grant();

    await expect(provider.getToken('auth-service', SCOPES)).resolves.toBe(
      'token-1',
    );

    const expectedAuthorization = `Basic ${Buffer.from(
      `notification-service:${SECRET}`,
    ).toString('base64')}`;

    expect(post).toHaveBeenCalledWith(
      'http://auth.test/api/service-tokens',
      { audience: 'auth-service', scopes: SCOPES },
      expect.objectContaining({
        headers: { Authorization: expectedAuthorization },
        maxRedirects: 0,
      }),
    );
  });

  it('reuses a cached token until the refresh margin', async () => {
    grant();
    grant();

    await provider.getToken('auth-service', SCOPES);
    advance(300_000 - SERVICE_TOKEN_REFRESH_MARGIN_MS - 1000);
    await expect(provider.getToken('auth-service', SCOPES)).resolves.toBe(
      'token-1',
    );

    advance(1000);
    await expect(provider.getToken('auth-service', SCOPES)).resolves.toBe(
      'token-2',
    );
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('honours the expiresIn auth-service returns', async () => {
    grant(60);
    grant();

    await provider.getToken('auth-service', SCOPES);
    advance(60_000 - SERVICE_TOKEN_REFRESH_MARGIN_MS);

    await expect(provider.getToken('auth-service', SCOPES)).resolves.toBe(
      'token-2',
    );
  });

  it('keeps audiences apart', async () => {
    grant();
    grant();

    await provider.getToken('auth-service', SCOPES);
    await expect(provider.getToken('trip-service', SCOPES)).resolves.toBe(
      'token-2',
    );
  });

  it('shares one request between concurrent callers', async () => {
    grant();

    const tokens = await Promise.all([
      provider.getToken('auth-service', SCOPES),
      provider.getToken('auth-service', SCOPES),
      provider.getToken('auth-service', SCOPES),
    ]);

    expect(tokens).toEqual(['token-1', 'token-1', 'token-1']);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a missing accessToken', { tokenType: 'Bearer', expiresIn: 300 }],
    [
      'an empty accessToken',
      { accessToken: '', tokenType: 'Bearer', expiresIn: 300 },
    ],
    [
      'a wrong tokenType',
      { accessToken: 'x', tokenType: 'Basic', expiresIn: 300 },
    ],
    [
      'a zero expiresIn',
      { accessToken: 'x', tokenType: 'Bearer', expiresIn: 0 },
    ],
    [
      'a negative expiresIn',
      { accessToken: 'x', tokenType: 'Bearer', expiresIn: -5 },
    ],
    [
      'a fractional expiresIn',
      { accessToken: 'x', tokenType: 'Bearer', expiresIn: 1.5 },
    ],
    ['no body', null],
  ])('rejects %s with 503 and caches nothing', async (_case, data) => {
    post.mockResolvedValueOnce({ status: 200, data });
    grant();

    await expect(
      provider.getToken('auth-service', SCOPES),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(provider.getToken('auth-service', SCOPES)).resolves.toBe(
      'token-1',
    );
    expect(error.mock.calls[0][0]).toContain('malformed response body');
  });

  it.each([
    [401, 'client credentials rejected'],
    [403, 'audience or scope not allowed'],
    [503, 'auth-service error 503'],
    [404, 'unexpected status 404'],
  ])('logs a distinct category for status %s', async (status, category) => {
    post.mockResolvedValueOnce({ status, data: {} });

    await expect(
      provider.getToken('auth-service', SCOPES),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(error.mock.calls[0][0]).toContain(category);
  });

  it('reports a timeout as a network failure', async () => {
    post.mockRejectedValueOnce(new Error('timeout of 3000ms exceeded'));

    await expect(
      provider.getToken('auth-service', SCOPES),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(error.mock.calls[0][0]).toContain('network error or timeout');
  });

  it('never returns an expired token when a refresh fails', async () => {
    grant();
    await provider.getToken('auth-service', SCOPES);

    advance(300_000);
    post.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

    await expect(
      provider.getToken('auth-service', SCOPES),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('never logs the secret or a token', async () => {
    grant();
    await provider.getToken('auth-service', SCOPES);
    post.mockResolvedValueOnce({ status: 401, data: {} });
    await expect(provider.getToken('trip-service', SCOPES)).rejects.toThrow();

    const logged = JSON.stringify(error.mock.calls);

    expect(logged).not.toContain(SECRET);
    expect(logged).not.toContain('token-1');
  });
});
