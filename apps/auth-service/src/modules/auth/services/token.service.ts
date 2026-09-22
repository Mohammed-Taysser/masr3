import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';

import UserEntity from '../../users/entities/user.entity';
import { JwtPayload } from '../auth.interface';

@Injectable()
class TokenService {
  constructor(private readonly jwtService: JwtService) {}

  generateTokens(user: UserEntity) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user,
    };
  }

  generateResetToken(): string {
    return randomBytes(32).toString('hex');
  }

  hashResetToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  getResetTokenExpiry(): Date {
    const expiresAt = new Date();

    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    return expiresAt;
  }
}

export default TokenService;
