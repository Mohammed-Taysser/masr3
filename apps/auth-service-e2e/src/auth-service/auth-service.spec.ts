import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { config } from 'dotenv';
import { resolve } from 'node:path';

// The running service's own env holds the notification-service client secret.
const { parsed: authEnv } = config({
  path: resolve(__dirname, '../../../auth-service/.env'),
  processEnv: {},
});
const CLIENT_SECRET = authEnv.NOTIFICATION_SERVICE_CLIENT_SECRET;
const PASSWORD = 'ChangeMe123!';

// The global throttler allows 3 requests a second per IP.
const pause = () => new Promise((done) => setTimeout(done, 400));

async function send<T = Record<string, unknown>>(
  request: AxiosRequestConfig,
): Promise<AxiosResponse<T>> {
  await pause();

  return axios.request<T>({ validateStatus: () => true, ...request });
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const basic = (username: string, password: string) => ({
  Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
});

interface Tokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: { id: number };
}

const login = async (email: string) =>
  (
    await send<Tokens>({
      method: 'POST',
      url: '/api/auth/login',
      data: { email, password: PASSWORD },
    })
  ).data;

const refresh = (refreshToken: string) =>
  send({ method: 'POST', url: '/api/auth/refresh', data: { refreshToken } });

const me = (token: string) =>
  send({ method: 'GET', url: '/api/auth/me', headers: bearer(token) });

const requestServiceToken = (
  headers: Record<string, string>,
  data: Record<string, unknown> = {
    audience: 'auth-service',
    scopes: ['USERS_CONTACT_READ'],
  },
) => send({ method: 'POST', url: '/api/service-tokens', headers, data });

const contact = (userId: number, token: string) =>
  send({
    method: 'GET',
    url: `/api/internal/users/${userId}/contact`,
    headers: bearer(token),
  });

describe('auth-service authentication', () => {
  const email = `e2e-${Date.now()}@masr3.local`;
  let admin: Tokens;
  let user: Tokens;
  let serviceToken: string;

  beforeAll(async () => {
    admin = await login('admin@masr3.local');

    const registered = await send<Tokens>({
      method: 'POST',
      url: '/api/auth/register',
      data: { email, password: PASSWORD, firstName: 'E2e', lastName: 'User' },
    });

    expect(registered.status).toBe(201);
    user = registered.data;

    serviceToken = (
      await requestServiceToken(basic('notification-service', CLIENT_SECRET))
    ).data.accessToken as string;
  }, 30000);

  afterAll(async () => {
    await send({
      method: 'DELETE',
      url: `/api/users/${user.user.id}`,
      headers: bearer(admin.accessToken),
    });
  }, 30000);

  it('publishes the signing key without private material', async () => {
    const response = await send<{ keys: Record<string, string>[] }>({
      method: 'GET',
      url: '/api/.well-known/jwks.json',
    });

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=300');
    expect(response.data.keys[0]).toMatchObject({
      kty: 'RSA',
      use: 'sig',
      alg: 'RS256',
      kid: expect.any(String),
    });
    expect(JSON.stringify(response.data)).not.toMatch(/"(d|p|q|dp|dq|qi)"/);
  });

  describe('user tokens', () => {
    it('returns an access and a refresh token', () => {
      expect(user).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        tokenType: 'Bearer',
        expiresIn: 300,
      });
    });

    it('accepts the access token and rejects the refresh token on /auth/me', async () => {
      expect((await me(user.accessToken)).status).toBe(200);
      expect((await me(user.refreshToken)).status).toBe(401);
    });

    it('issues a working access token from the refresh token only', async () => {
      const refreshed = await refresh(user.refreshToken);

      expect(refreshed.status).toBe(200);
      expect(refreshed.data).not.toHaveProperty('refreshToken');
      expect((await me(refreshed.data.accessToken as string)).status).toBe(200);
      expect((await refresh(user.accessToken)).status).toBe(401);
    });

    it('rejects a CUSTOMER on an admin-only route with 403', async () => {
      const response = await send({
        method: 'GET',
        url: '/api/users/1',
        headers: bearer(user.accessToken),
      });

      expect(response.status).toBe(403);
    });
  });

  describe('service tokens', () => {
    it('lets notification-service read a contact', async () => {
      const response = await contact(user.user.id, serviceToken);

      expect(response.status).toBe(200);
      expect(response.data).toEqual({
        userId: user.user.id,
        email,
        firstName: 'E2e',
        lastName: 'User',
      });
    });

    it('returns 404 for a missing user', async () => {
      expect((await contact(2_000_000_000, serviceToken)).status).toBe(404);
    });

    it('rejects user and refresh tokens on the internal route, even an ADMIN one', async () => {
      expect((await contact(user.user.id, admin.accessToken)).status).toBe(401);
      expect((await contact(user.user.id, admin.refreshToken)).status).toBe(
        401,
      );
    });

    it('rejects a service token on a user route', async () => {
      expect((await me(serviceToken)).status).toBe(401);
    });

    it('rejects a wrong secret and a malformed Basic header with 401', async () => {
      const wrongSecret = await requestServiceToken(
        basic('notification-service', 'cd'.repeat(32)),
      );

      expect(wrongSecret.status).toBe(401);
      expect(wrongSecret.headers['www-authenticate']).toContain('Basic');
      expect(
        (await requestServiceToken({ Authorization: 'Basic !!!' })).status,
      ).toBe(401);
    });

    it('rejects an audience outside the client allowlist with 403', async () => {
      const response = await requestServiceToken(
        basic('notification-service', CLIENT_SECRET),
        { audience: 'trip-service', scopes: ['USERS_CONTACT_READ'] },
      );

      expect(response.status).toBe(403);
    });
  });

  describe('revocation through tokenVersion', () => {
    it('revokes tokens at once on a role change', async () => {
      const update = await send({
        method: 'PATCH',
        url: `/api/users/${user.user.id}`,
        headers: bearer(admin.accessToken),
        data: { role: 'DRIVER' },
      });

      expect(update.status).toBe(200);
      expect((await me(user.accessToken)).status).toBe(401);
      expect((await refresh(user.refreshToken)).status).toBe(401);

      user = { ...user, ...(await login(email)) };
    });

    it('does not revive refresh tokens on reactivation', async () => {
      const setStatus = (isActive: boolean) =>
        send({
          method: 'PATCH',
          url: `/api/users/${user.user.id}/status`,
          headers: bearer(admin.accessToken),
          data: { isActive },
        });

      expect((await setStatus(false)).status).toBe(204);
      expect((await setStatus(true)).status).toBe(204);
      expect((await refresh(user.refreshToken)).status).toBe(401);

      user = { ...user, ...(await login(email)) };
    });

    it('revokes the refresh token on a password change', async () => {
      const response = await send({
        method: 'POST',
        url: '/api/auth/change-password',
        headers: bearer(user.accessToken),
        data: { currentPassword: PASSWORD, newPassword: PASSWORD },
      });

      expect(response.status).toBe(200);
      expect((await refresh(user.refreshToken)).status).toBe(401);

      user = { ...user, ...(await login(email)) };
    });

    it('revokes the refresh token on logout', async () => {
      const response = await send({
        method: 'POST',
        url: '/api/auth/logout',
        headers: bearer(user.accessToken),
      });

      expect(response.status).toBe(200);
      expect((await refresh(user.refreshToken)).status).toBe(401);
    });
  });
});
