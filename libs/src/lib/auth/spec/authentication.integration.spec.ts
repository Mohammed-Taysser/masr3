import { Controller, Get, INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import axios from 'axios';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';

import { REFRESH_TOKEN_AUDIENCE } from '../auth.constant';
import { CurrentUser, Public } from '../auth.decorator';
import type { AuthenticatedUser } from '../auth.interface';
import AuthenticationGuard from '../authentication.guard';
import AuthenticationModule from '../authentication.module';
import {
  createTestKey,
  refreshClaims,
  serviceClaims,
  signToken,
  TestKey,
  userClaims,
} from './token.fixture';

@Controller('trips')
class TripsTestController {
  @Get('mine')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return { userId: user.id };
  }

  @Get('public')
  @Public()
  open() {
    return { open: true };
  }
}

describe('AuthenticationModule (integration)', () => {
  let key: TestKey;
  let jwksServer: Server;
  let jwksRequests = 0;
  let app: INestApplication;
  let baseUrl: string;

  const get = (path: string, token?: string) =>
    axios.get(`${baseUrl}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      validateStatus: () => true,
    });

  beforeAll(async () => {
    key = createTestKey('current-key');

    jwksServer = createServer((request, response) => {
      if (request.url !== '/api/.well-known/jwks.json') {
        response.writeHead(404).end();
        return;
      }

      jwksRequests += 1;
      response
        .writeHead(200, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ keys: [key.jwk] }));
    });
    await new Promise<void>((resolve) =>
      jwksServer.listen(0, '127.0.0.1', resolve),
    );

    const { port } = jwksServer.address() as AddressInfo;
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              SERVICE_NAME: 'trip-service',
              AUTH_SERVICE_URL: `http://127.0.0.1:${port}/api`,
            }),
          ],
        }),
        AuthenticationModule.register(),
      ],
      controllers: [TripsTestController],
      providers: [{ provide: APP_GUARD, useExisting: AuthenticationGuard }],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
    await new Promise((resolve) => jwksServer.close(resolve));
  });

  it('accepts a valid access token, verified against the fetched JWKS', async () => {
    const response = await get(
      '/trips/mine',
      signToken(key, userClaims({ sub: '42' }), { expiresIn: 300 }),
    );

    expect(response.status).toBe(200);
    expect(response.data).toEqual({ userId: 42 });
    expect(jwksRequests).toBe(1);
  });

  it('rejects a refresh token with 401', async () => {
    const response = await get(
      '/trips/mine',
      signToken(key, refreshClaims(), {
        audience: REFRESH_TOKEN_AUDIENCE,
        expiresIn: 300,
      }),
    );

    expect(response.status).toBe(401);
  });

  it('rejects a service token with 401', async () => {
    const response = await get(
      '/trips/mine',
      signToken(key, serviceClaims(), {
        audience: 'trip-service',
        expiresIn: 300,
      }),
    );

    expect(response.status).toBe(401);
  });

  it('rejects a request without a token with 401', async () => {
    expect((await get('/trips/mine')).status).toBe(401);
  });

  it('serves a public route without a token', async () => {
    expect((await get('/trips/public')).status).toBe(200);
  });

  it('reuses the cached JWKS across requests', async () => {
    expect(jwksRequests).toBe(1);
  });
});
