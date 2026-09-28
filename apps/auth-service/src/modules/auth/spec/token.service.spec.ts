import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';

import TokenService from '../services/token.service';
import UserEntity from '../../users/entities/user.entity';
import { UserRoleEnum } from '../../users/users.enum';

describe('TokenService', () => {
  let service: TokenService;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  const user = {
    id: 1,
    email: 'john@example.com',
    role: UserRoleEnum.CUSTOMER,
    tokenVersion: 3,
  } as UserEntity;

  beforeEach(() => {
    jwtService = {
      sign: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    configService = {
      getOrThrow: jest.fn().mockReturnValue(600000),
    } as unknown as jest.Mocked<ConfigService>;

    service = new TokenService(jwtService, configService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateTokens', () => {
    it('signs a payload built from the user', () => {
      jwtService.sign.mockReturnValue('signed-token');

      service.generateTokens(user);

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: user.id,
        email: user.email,
        role: user.role,
        tokenVersion: user.tokenVersion,
      });
    });

    it('returns the signed access token', () => {
      jwtService.sign.mockReturnValue('signed-token');

      const result = service.generateTokens(user);

      expect(result).toBe('signed-token');
    });
  });

  describe('createResetToken', () => {
    it('returns a 64-character hex token', () => {
      const { token } = service.createResetToken();

      expect(token).toMatch(/^[a-f0-9]{64}$/);
    });

    it('returns a different token on each call', () => {
      const first = service.createResetToken().token;
      const second = service.createResetToken().token;

      expect(first).not.toBe(second);
    });

    it('returns the sha256 hash of the token it generated', () => {
      const { token, tokenHash } = service.createResetToken();

      expect(tokenHash).toBe(
        createHash('sha256').update(token).digest('hex'),
      );
    });

    it('does not return the raw token as the hash', () => {
      const { token, tokenHash } = service.createResetToken();

      expect(tokenHash).not.toBe(token);
    });
  });

  describe('hashToken', () => {
    it('returns the sha256 hex digest of the input', () => {
      const expected = createHash('sha256')
        .update('raw-token')
        .digest('hex');

      expect(service.hashToken('raw-token')).toBe(expected);
    });

    it('produces the same hash for the same input', () => {
      expect(service.hashToken('same')).toBe(
        service.hashToken('same'),
      );
    });

    it('produces different hashes for different input', () => {
      expect(service.hashToken('a')).not.toBe(
        service.hashToken('b'),
      );
    });
  });

  describe('getResetTokenExpiry', () => {
    it('returns a date PASSWORD_RESET_TOKEN_TTL_MS in the future', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-22T12:00:00.000Z'));
      configService.getOrThrow.mockReturnValue(600000);

      const expiresAt = service.getResetTokenExpiry();

      expect(configService.getOrThrow).toHaveBeenCalledWith(
        'PASSWORD_RESET_TOKEN_TTL_MS',
      );
      expect(expiresAt).toEqual(new Date('2026-09-22T12:10:00.000Z'));

      jest.useRealTimers();
    });

    it('follows the configured ttl', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-22T12:00:00.000Z'));
      configService.getOrThrow.mockReturnValue(3600000);

      expect(service.getResetTokenExpiry()).toEqual(
        new Date('2026-09-22T13:00:00.000Z'),
      );

      jest.useRealTimers();
    });
  });
});
