import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';

import {
  AccessTokenClaims,
  REFRESH_TOKEN_AUDIENCE,
  RefreshTokenClaims,
  TokenUseEnum,
  USER_TOKEN_AUDIENCE,
} from '@masr3/libs/auth';
import { dayjs } from '@masr3/libs/date';

import SigningKeyService from '../../signing-key/signing-key.service';
import UserEntity from '../../users/entities/user.entity';

@Injectable()
class TokenService {
  constructor(
    private readonly signingKeyService: SigningKeyService,
    private readonly configService: ConfigService,
  ) {}

  private readonly PASSWORD_RESET_TOKEN_TTL_MS =
    this.configService.getOrThrow<number>('PASSWORD_RESET_TOKEN_TTL_MS');
  private readonly REFRESH_TOKEN_EXPIRES_IN_SECONDS =
    this.configService.getOrThrow<number>('REFRESH_TOKEN_EXPIRES_IN_SECONDS');
  readonly ACCESS_TOKEN_EXPIRES_IN_SECONDS =
    this.configService.getOrThrow<number>('ACCESS_TOKEN_EXPIRES_IN_SECONDS');

  generateAccessToken(user: UserEntity): string {
    const claims: AccessTokenClaims = {
      sub: String(user.id),
      tokenUse: TokenUseEnum.USER,
      role: user.role,
      tokenVersion: user.tokenVersion,
      email: user.email,
    };

    return this.signingKeyService.sign(
      claims,
      USER_TOKEN_AUDIENCE,
      this.ACCESS_TOKEN_EXPIRES_IN_SECONDS,
    );
  }

  generateRefreshToken(user: UserEntity): string {
    const claims: RefreshTokenClaims = {
      sub: String(user.id),
      tokenUse: TokenUseEnum.REFRESH,
      tokenVersion: user.tokenVersion,
    };

    return this.signingKeyService.sign(
      claims,
      REFRESH_TOKEN_AUDIENCE,
      this.REFRESH_TOKEN_EXPIRES_IN_SECONDS,
    );
  }

  // The raw token goes to the user only; the database keeps its hash.
  createResetToken(): { token: string; tokenHash: string; expiresAt: Date } {
    const token = randomBytes(32).toString('hex');

    return {
      token,
      tokenHash: this.hashToken(token),
      expiresAt: dayjs()
        .add(this.PASSWORD_RESET_TOKEN_TTL_MS, 'millisecond')
        .toDate(),
    };
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}

export default TokenService;
