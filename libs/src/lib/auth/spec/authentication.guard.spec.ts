import {
  ExecutionContext,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

import { REFRESH_TOKEN_AUDIENCE } from '../auth.constant';
import { Public, RequireServiceScopes, Roles } from '../auth.decorator';
import { ServiceScopeEnum, UserRoleEnum } from '../auth.enum';
import type { KeyResolver, UserPrincipalValidator } from '../auth.interface';
import AuthenticationGuard from '../authentication.guard';
import TokenVerifierService from '../token-verifier.service';
import {
  createTestKey,
  refreshClaims,
  serviceClaims,
  signToken,
  TestKey,
  userClaims,
} from './token.fixture';

const SERVICE_NAME = 'auth-service';
const OTHER_SCOPE = 'OTHER_SCOPE' as ServiceScopeEnum;

class TestController {
  protectedRoute() {
    return true;
  }

  @Roles(UserRoleEnum.ADMIN)
  adminRoute() {
    return true;
  }

  @Public()
  publicRoute() {
    return true;
  }

  @RequireServiceScopes(ServiceScopeEnum.USERS_CONTACT_READ)
  serviceRoute() {
    return true;
  }

  @Public()
  @RequireServiceScopes(ServiceScopeEnum.USERS_CONTACT_READ)
  publicServiceRoute() {
    return true;
  }

  @Public()
  @Roles(UserRoleEnum.ADMIN)
  publicRolesRoute() {
    return true;
  }

  @RequireServiceScopes(ServiceScopeEnum.USERS_CONTACT_READ)
  @Roles(UserRoleEnum.ADMIN)
  serviceRolesRoute() {
    return true;
  }

  @RequireServiceScopes(ServiceScopeEnum.USERS_CONTACT_READ, OTHER_SCOPE)
  twoScopesRoute() {
    return true;
  }
}

@RequireServiceScopes(ServiceScopeEnum.USERS_CONTACT_READ)
class ServiceOnlyController {
  inheritedRoute() {
    return true;
  }
}

type Handler = keyof TestController;

describe('AuthenticationGuard', () => {
  let key: TestKey;
  let verifier: TokenVerifierService;
  let validator: jest.Mocked<UserPrincipalValidator>;
  let guard: AuthenticationGuard;

  const contextFor = (
    handler: () => unknown,
    controller: object,
    authorization?: string,
  ) => {
    const request = { headers: { authorization } } as unknown as Request;
    const context = {
      getHandler: () => handler,
      getClass: () => controller,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    return { context, request };
  };

  const run = (handler: Handler, authorization?: string) => {
    const { context, request } = contextFor(
      TestController.prototype[handler],
      TestController,
      authorization,
    );

    return guard.canActivate(context).then((allowed) => ({ allowed, request }));
  };

  const bearer = (token: string) => `Bearer ${token}`;
  const userToken = (overrides: Record<string, unknown> = {}) =>
    bearer(signToken(key, userClaims(overrides), { expiresIn: 300 }));
  const serviceToken = (overrides: Record<string, unknown> = {}) =>
    bearer(
      signToken(key, serviceClaims(overrides), {
        audience: SERVICE_NAME,
        expiresIn: 300,
      }),
    );
  const refreshToken = () =>
    bearer(
      signToken(key, refreshClaims(), {
        audience: REFRESH_TOKEN_AUDIENCE,
        expiresIn: 300,
      }),
    );

  beforeAll(() => {
    key = createTestKey('current-key');
  });

  beforeEach(() => {
    const keyResolver: KeyResolver = {
      getPublicKey: async () => key.publicPem,
    };

    verifier = new TokenVerifierService(new JwtService(), keyResolver);
    validator = { isCurrent: jest.fn().mockResolvedValue(true) };
    guard = new AuthenticationGuard(
      new Reflector(),
      verifier,
      { getOrThrow: () => SERVICE_NAME } as unknown as ConfigService,
      validator,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  describe('user routes', () => {
    it('attaches the user for a valid access token', async () => {
      const { allowed, request } = await run('protectedRoute', userToken());

      expect(allowed).toBe(true);
      expect(request.user).toEqual({
        id: 7,
        email: 'customer@masr3.local',
        role: UserRoleEnum.CUSTOMER,
        tokenVersion: 0,
      });
    });

    it.each([
      ['no header', undefined],
      ['a non-bearer scheme', 'Basic abc'],
      ['an empty bearer', 'Bearer '],
    ])('rejects %s with 401', async (_case, authorization) => {
      await expect(run('protectedRoute', authorization)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('accepts a lowercase bearer scheme', async () => {
      const token = signToken(key, userClaims(), { expiresIn: 300 });

      await expect(
        run('protectedRoute', `bearer ${token}`),
      ).resolves.toMatchObject({ allowed: true });
    });

    it('rejects a service token and a refresh token with 401', async () => {
      await expect(
        run('protectedRoute', serviceToken()),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(run('adminRoute', serviceToken())).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      await expect(
        run('protectedRoute', refreshToken()),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a user the validator no longer considers current', async () => {
      validator.isCurrent.mockResolvedValue(false);

      await expect(run('protectedRoute', userToken())).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('lets a validator failure surface as itself, not as 401', async () => {
      const outage = new Error('connection terminated');

      validator.isCurrent.mockRejectedValue(outage);

      await expect(run('protectedRoute', userToken())).rejects.toBe(outage);
    });

    it('works without a validator', async () => {
      guard = new AuthenticationGuard(new Reflector(), verifier, {
        getOrThrow: () => SERVICE_NAME,
      } as unknown as ConfigService);

      await expect(run('protectedRoute', userToken())).resolves.toMatchObject({
        allowed: true,
      });
    });
  });

  describe('roles', () => {
    it('rejects a CUSTOMER on an ADMIN-only route with 403', async () => {
      await expect(run('adminRoute', userToken())).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('allows an ADMIN', async () => {
      await expect(
        run('adminRoute', userToken({ role: UserRoleEnum.ADMIN })),
      ).resolves.toMatchObject({ allowed: true });
    });

    it('lets any role through a route without @Roles', async () => {
      await expect(
        run('protectedRoute', userToken({ role: UserRoleEnum.DRIVER })),
      ).resolves.toMatchObject({ allowed: true });
    });
  });

  describe('service routes', () => {
    it('attaches the service for a token with the required scope', async () => {
      const { allowed, request } = await run('serviceRoute', serviceToken());

      expect(allowed).toBe(true);
      expect(request.service).toEqual({
        name: 'notification-service',
        scopes: [ServiceScopeEnum.USERS_CONTACT_READ],
      });
      expect(request.user).toBeUndefined();
    });

    it('rejects a user token with 401, even for an ADMIN', async () => {
      await expect(
        run('serviceRoute', userToken({ role: UserRoleEnum.ADMIN })),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a refresh token with 401', async () => {
      await expect(run('serviceRoute', refreshToken())).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a service token for another audience with 401', async () => {
      const token = signToken(key, serviceClaims(), {
        audience: 'trip-service',
        expiresIn: 300,
      });

      await expect(run('serviceRoute', bearer(token))).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('requires every listed scope', async () => {
      await expect(
        run('twoScopesRoute', serviceToken()),
      ).rejects.toBeInstanceOf(ForbiddenException);

      jest.spyOn(verifier, 'verify').mockResolvedValue({
        ...serviceClaims({
          scopes: [ServiceScopeEnum.USERS_CONTACT_READ, OTHER_SCOPE],
        }),
      } as never);

      await expect(
        run('twoScopesRoute', 'Bearer stubbed'),
      ).resolves.toMatchObject({ allowed: true });
    });

    it('applies class-level scopes to every handler', async () => {
      const { context } = contextFor(
        ServiceOnlyController.prototype.inheritedRoute,
        ServiceOnlyController,
        userToken(),
      );

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('public routes', () => {
    it('allows a request without a token', async () => {
      await expect(run('publicRoute')).resolves.toMatchObject({
        allowed: true,
      });
    });

    it('still requires a service token when service scopes are present', async () => {
      await expect(run('publicServiceRoute')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      await expect(
        run('publicServiceRoute', serviceToken()),
      ).resolves.toMatchObject({ allowed: true });
    });

    it.each(['publicRolesRoute', 'serviceRolesRoute'] as Handler[])(
      'fails closed on the misconfigured %s',
      async (handler) => {
        const error = jest
          .spyOn(Logger.prototype, 'error')
          .mockImplementation();

        await expect(run(handler, serviceToken())).rejects.toBeInstanceOf(
          InternalServerErrorException,
        );
        expect(error).toHaveBeenCalled();
      },
    );
  });

  it('keeps tokens out of logs', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const authorization = refreshToken();

    await expect(run('protectedRoute', authorization)).rejects.toThrow();

    expect(JSON.stringify(warn.mock.calls)).not.toContain(
      authorization.slice('Bearer '.length),
    );
  });
});
