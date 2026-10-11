import { ModuleMetadata, Type } from '@nestjs/common';

import { ServiceScopeEnum, TokenUseEnum, UserRoleEnum } from './auth.enum';

type JsonObject = Record<string, unknown>;

interface RegisteredClaims {
  sub: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

interface AccessTokenClaims {
  sub: string;
  tokenUse: TokenUseEnum.USER;
  role: UserRoleEnum;
  tokenVersion: number;
  email: string;
}

interface RefreshTokenClaims {
  sub: string;
  tokenUse: TokenUseEnum.REFRESH;
  tokenVersion: number;
}

interface ServiceTokenClaims {
  sub: string;
  tokenUse: TokenUseEnum.SERVICE;
  scopes: ServiceScopeEnum[];
}

type AccessTokenPayload = AccessTokenClaims & RegisteredClaims;
type RefreshTokenPayload = RefreshTokenClaims & RegisteredClaims;
type ServiceTokenPayload = ServiceTokenClaims & RegisteredClaims;

interface TokenPayloadMap {
  [TokenUseEnum.USER]: AccessTokenPayload;
  [TokenUseEnum.REFRESH]: RefreshTokenPayload;
  [TokenUseEnum.SERVICE]: ServiceTokenPayload;
}

interface AuthenticatedUser {
  id: number;
  email: string;
  role: UserRoleEnum;
  tokenVersion: number;
}

interface AuthenticatedService {
  name: string;
  scopes: ServiceScopeEnum[];
}

interface UserContact {
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
}

interface CachedServiceToken {
  accessToken: string;
  expiresAt: number;
}

interface ServiceTokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

interface KeyResolver {
  getPublicKey(keyId: string): Promise<string>;
}

interface UserPrincipalValidator {
  isCurrent(user: AuthenticatedUser): Promise<boolean>;
}

interface AuthenticationModuleOptions {
  imports?: ModuleMetadata['imports'];
  keyResolver?: Type<KeyResolver>;
  userValidator?: Type<UserPrincipalValidator>;
}

declare global {
  // Declaration merging is the only way to type Express's request; a type
  // alias cannot merge.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      service?: AuthenticatedService;
    }
  }
}

export type {
  AccessTokenClaims,
  AccessTokenPayload,
  AuthenticatedService,
  AuthenticatedUser,
  AuthenticationModuleOptions,
  CachedServiceToken,
  JsonObject,
  KeyResolver,
  RefreshTokenClaims,
  RefreshTokenPayload,
  ServiceTokenClaims,
  ServiceTokenPayload,
  ServiceTokenResponse,
  TokenPayloadMap,
  UserContact,
  UserPrincipalValidator,
};
