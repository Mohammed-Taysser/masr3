import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';

import UserEntity from '../../users/entities/user.entity';
import { JwtPayload } from '../auth.interface';

@Injectable()
class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  generateTokens(user: UserEntity) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };

    return this.jwtService.sign(payload)
  }

  createResetToken(): { token: string; tokenHash: string } {
    const token = randomBytes(32).toString('hex');

    return { token, tokenHash: this.hashToken(token) };
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  getResetTokenExpiry(): Date {
    const ttlMs = this.configService.getOrThrow<number>(
      'PASSWORD_RESET_TOKEN_TTL_MS',
    );

    return new Date(Date.now() + ttlMs);
  }
}

export default TokenService;
