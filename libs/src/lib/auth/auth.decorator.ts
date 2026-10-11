import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { Request } from 'express';

import { IS_PUBLIC_KEY, ROLES_KEY, SERVICE_SCOPES_KEY } from './auth.constant';
import { ServiceScopeEnum, UserRoleEnum } from './auth.enum';

const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

const Roles = (...roles: UserRoleEnum[]) => SetMetadata(ROLES_KEY, roles);

// Marks a route as service-only: user and refresh tokens are rejected, and
// every listed scope must be present.
const RequireServiceScopes = (
  scope: ServiceScopeEnum,
  ...otherScopes: ServiceScopeEnum[]
) => SetMetadata(SERVICE_SCOPES_KEY, [scope, ...otherScopes]);

const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<Request>().user,
);

const CurrentService = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<Request>().service,
);

export { CurrentService, CurrentUser, Public, RequireServiceScopes, Roles };
