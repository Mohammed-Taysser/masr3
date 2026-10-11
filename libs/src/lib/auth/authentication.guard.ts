import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import {
  BEARER_HEADER_PATTERN,
  IS_PUBLIC_KEY,
  ROLES_KEY,
  SERVICE_SCOPES_KEY,
  USER_PRINCIPAL_VALIDATOR,
  USER_TOKEN_AUDIENCE,
} from './auth.constant';
import { ServiceScopeEnum, TokenUseEnum, UserRoleEnum } from './auth.enum';
import type {
  AuthenticatedUser,
  UserPrincipalValidator,
} from './auth.interface';
import TokenVerifierService from './token-verifier.service';

@Injectable()
class AuthenticationGuard implements CanActivate {
  private readonly logger = new Logger(AuthenticationGuard.name);
  private readonly serviceName: string;

  constructor(
    private readonly reflector: Reflector,
    private readonly tokenVerifier: TokenVerifierService,
    configService: ConfigService,
    @Optional()
    @Inject(USER_PRINCIPAL_VALIDATOR)
    private readonly userValidator?: UserPrincipalValidator,
  ) {
    this.serviceName = configService.getOrThrow<string>('SERVICE_NAME');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];

    const requiredScopes =
      this.reflector.getAllAndOverride<ServiceScopeEnum[] | undefined>(
        SERVICE_SCOPES_KEY,
        targets,
      ) ?? [];

    const requiredRoles =
      this.reflector.getAllAndOverride<UserRoleEnum[] | undefined>(
        ROLES_KEY,
        targets,
      ) ?? [];

    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      targets,
    );

    const request = context.switchToHttp().getRequest<Request>();
    const hasRoles = requiredRoles.length > 0;
    const isServiceRoute = requiredScopes.length > 0;

    // Service metadata is checked before @Public, so a service-only route can
    // never become public by accident.
    if (isServiceRoute) {
      if (hasRoles) {
        this.logger.error(
          `${this.routeName(context)} combines @RequireServiceScopes with @Roles`,
        );

        throw new InternalServerErrorException();
      }

      const payload = await this.tokenVerifier.verify(
        this.readBearerToken(request),
        TokenUseEnum.SERVICE,
        this.serviceName,
      );

      const hasRequiredScopes = requiredScopes.every((scope) =>
        payload.scopes.includes(scope),
      );

      if (!hasRequiredScopes) {
        throw new ForbiddenException('Missing required service scope');
      }

      request.service = { name: payload.sub, scopes: payload.scopes };

      return true;
    }

    if (isPublic) {
      if (hasRoles) {
        this.logger.error(
          `${this.routeName(context)} combines @Public with @Roles`,
        );

        throw new InternalServerErrorException();
      }

      return true;
    }

    const payload = await this.tokenVerifier.verify(
      this.readBearerToken(request),
      TokenUseEnum.USER,
      USER_TOKEN_AUDIENCE,
    );

    const user: AuthenticatedUser = {
      id: Number(payload.sub),
      email: payload.email,
      role: payload.role,
      tokenVersion: payload.tokenVersion,
    };

    const isCurrentUser = this.userValidator
      ? await this.userValidator.isCurrent(user)
      : true;

    if (!isCurrentUser) {
      throw new UnauthorizedException('Invalid access token');
    }

    const hasRequiredRole = !hasRoles || requiredRoles.includes(user.role);

    if (!hasRequiredRole) {
      throw new ForbiddenException('Insufficient role');
    }

    request.user = user;

    return true;
  }

  private readBearerToken(request: Request): string {
    const header = request.headers.authorization;
    const match =
      typeof header === 'string' ? BEARER_HEADER_PATTERN.exec(header) : null;

    if (!match?.[1]) {
      throw new UnauthorizedException('Missing bearer token');
    }

    return match[1];
  }

  private routeName(context: ExecutionContext): string {
    return `${context.getClass().name}.${context.getHandler().name}`;
  }
}

export default AuthenticationGuard;
