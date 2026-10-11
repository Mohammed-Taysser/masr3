import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JsonWebTokenError, JwtService } from '@nestjs/jwt';

import {
  CLOCK_TOLERANCE_SECONDS,
  JWT_ALGORITHM,
  KEY_RESOLVER,
  TOKEN_ISSUER,
  USER_SUBJECT_PATTERN,
} from './auth.constant';
import { ServiceScopeEnum, TokenUseEnum, UserRoleEnum } from './auth.enum';
import type {
  JsonObject,
  KeyResolver,
  TokenPayloadMap,
} from './auth.interface';

@Injectable()
class TokenVerifierService {
  private readonly logger = new Logger(TokenVerifierService.name);

  constructor(
    private readonly jwtService: JwtService,
    @Inject(KEY_RESOLVER) private readonly keyResolver: KeyResolver,
  ) {}

  async verify<T extends TokenUseEnum>(
    token: string,
    tokenUse: T,
    audience: string,
  ): Promise<TokenPayloadMap[T]> {
    const keyId = this.readKeyId(token, tokenUse);
    const publicKey = await this.keyResolver.getPublicKey(keyId);

    let claims: unknown;

    try {
      claims = await this.jwtService.verifyAsync(token, {
        publicKey,
        algorithms: [JWT_ALGORITHM],
        issuer: TOKEN_ISSUER,
        audience,
        clockTolerance: CLOCK_TOLERANCE_SECONDS,
      });
    } catch (error) {
      if (error instanceof JsonWebTokenError) {
        this.logger.warn(`Rejected ${tokenUse} token: ${error.message}`);

        throw new UnauthorizedException('Invalid access token');
      }

      throw error;
    }

    const hasExpectedClaims =
      this.isRecord(claims) &&
      this.hasRegisteredClaims(claims, audience) &&
      this.hasProfileClaims(claims, tokenUse);

    if (!hasExpectedClaims) {
      this.logger.warn(`Rejected ${tokenUse} token: claims do not match`);

      throw new UnauthorizedException('Invalid access token');
    }

    return claims as unknown as TokenPayloadMap[T];
  }

  private readKeyId(token: string, tokenUse: TokenUseEnum): string {
    let decoded: unknown;

    try {
      decoded = this.jwtService.decode(token, { complete: true });
    } catch {
      decoded = null;
    }

    const header = this.isRecord(decoded) ? decoded['header'] : null;
    const keyId = this.isRecord(header) ? header['kid'] : undefined;
    const isRs256 = this.isRecord(header) && header['alg'] === JWT_ALGORITHM;
    const hasKeyId = typeof keyId === 'string' && keyId.length > 0;

    if (!isRs256 || !hasKeyId) {
      this.logger.warn(`Rejected ${tokenUse} token: unexpected header`);

      throw new UnauthorizedException('Invalid access token');
    }

    return keyId as string;
  }

  private hasRegisteredClaims(claims: JsonObject, audience: string): boolean {
    const issuedAt = claims['iat'];
    const expiresAt = claims['exp'];

    // jsonwebtoken accepts an `aud` array containing the audience; the
    // contract is one exact string.
    return (
      claims['iss'] === TOKEN_ISSUER &&
      typeof claims['aud'] === 'string' &&
      claims['aud'] === audience &&
      Number.isInteger(issuedAt) &&
      Number.isInteger(expiresAt) &&
      (expiresAt as number) > (issuedAt as number)
    );
  }

  private hasProfileClaims(
    claims: JsonObject,
    tokenUse: TokenUseEnum,
  ): boolean {
    if (claims['tokenUse'] !== tokenUse) {
      return false;
    }

    switch (tokenUse) {
      case TokenUseEnum.USER:
        return (
          this.isUserSubject(claims['sub']) &&
          Object.values(UserRoleEnum).includes(
            claims['role'] as UserRoleEnum,
          ) &&
          this.isTokenVersion(claims['tokenVersion']) &&
          typeof claims['email'] === 'string'
        );
      case TokenUseEnum.REFRESH:
        return (
          this.isUserSubject(claims['sub']) &&
          this.isTokenVersion(claims['tokenVersion'])
        );
      case TokenUseEnum.SERVICE:
        return (
          typeof claims['sub'] === 'string' &&
          claims['sub'].length > 0 &&
          this.isServiceScopeList(claims['scopes'])
        );
    }
  }

  // Precision matters: the subject is turned back into a numeric user id.
  private isUserSubject(value: unknown): boolean {
    return (
      typeof value === 'string' &&
      USER_SUBJECT_PATTERN.test(value) &&
      Number.isSafeInteger(Number(value))
    );
  }

  private isTokenVersion(value: unknown): boolean {
    return Number.isInteger(value) && (value as number) >= 0;
  }

  private isServiceScopeList(value: unknown): boolean {
    return (
      Array.isArray(value) &&
      value.length > 0 &&
      value.every((scope) =>
        Object.values(ServiceScopeEnum).includes(scope as ServiceScopeEnum),
      )
    );
  }

  private isRecord(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}

export default TokenVerifierService;
