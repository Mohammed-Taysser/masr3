import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

import {
  REFRESH_TOKEN_AUDIENCE,
  TokenUseEnum,
  USER_TOKEN_AUDIENCE,
  UserRoleEnum,
} from '@masr3/libs/auth';

import TokenService from '../services/token.service';
import SigningKeyService from '../../signing-key/signing-key.service';
import UserEntity from '../../users/entities/user.entity';

describe('TokenService', () => {
  let service: TokenService;
  let signingKeyService: jest.Mocked<SigningKeyService>;
  let configService: jest.Mocked<ConfigService>;

  let config: Record<string, number>;

  const user = {
    id: 1,
    email: 'john@example.com',
    role: UserRoleEnum.CUSTOMER,
    tokenVersion: 3,
  } as UserEntity;

  beforeEach(() => {
    config = {
      ACCESS_TOKEN_EXPIRES_IN_SECONDS: 300,
      REFRESH_TOKEN_EXPIRES_IN_SECONDS: 604800,
      PASSWORD_RESET_TOKEN_TTL_MS: 600000,
    };

    signingKeyService = {
      sign: jest.fn().mockReturnValue('signed-token'),
    } as unknown as jest.Mocked<SigningKeyService>;

    configService = {
      getOrThrow: jest.fn((key: string) => config[key]),
    } as unknown as jest.Mocked<ConfigService>;

    service = new TokenService(signingKeyService, configService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateAccessToken', () => {
    it('signs the access claims with a string subject for 5 minutes', () => {
      expect(service.generateAccessToken(user)).toBe('signed-token');

      expect(signingKeyService.sign).toHaveBeenCalledWith(
        {
          sub: '1',
          tokenUse: TokenUseEnum.USER,
          role: user.role,
          tokenVersion: user.tokenVersion,
          email: user.email,
        },
        USER_TOKEN_AUDIENCE,
        300,
      );
    });
  });

  describe('generateRefreshToken', () => {
    it('signs only the refresh claims, for the refresh audience', () => {
      expect(service.generateRefreshToken(user)).toBe('signed-token');

      expect(signingKeyService.sign).toHaveBeenCalledWith(
        { sub: '1', tokenUse: TokenUseEnum.REFRESH, tokenVersion: 3 },
        REFRESH_TOKEN_AUDIENCE,
        604800,
      );
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

      expect(tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    });

    it('does not return the raw token as the hash', () => {
      const { token, tokenHash } = service.createResetToken();

      expect(tokenHash).not.toBe(token);
    });
  });

  describe('hashToken', () => {
    it('returns the sha256 hex digest of the input', () => {
      const expected = createHash('sha256').update('raw-token').digest('hex');

      expect(service.hashToken('raw-token')).toBe(expected);
    });

    it('produces the same hash for the same input', () => {
      expect(service.hashToken('same')).toBe(service.hashToken('same'));
    });

    it('produces different hashes for different input', () => {
      expect(service.hashToken('a')).not.toBe(service.hashToken('b'));
    });
  });

  describe('getResetTokenExpiry', () => {
    it('returns a date PASSWORD_RESET_TOKEN_TTL_MS in the future', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-22T12:00:00.000Z'));

      const expiresAt = service.getResetTokenExpiry();

      expect(configService.getOrThrow).toHaveBeenCalledWith(
        'PASSWORD_RESET_TOKEN_TTL_MS',
      );
      expect(expiresAt).toEqual(new Date('2026-09-22T12:10:00.000Z'));

      jest.useRealTimers();
    });

    it('follows the configured ttl', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-22T12:00:00.000Z'));
      // The TTL is read once, at construction.
      config['PASSWORD_RESET_TOKEN_TTL_MS'] = 3600000;
      service = new TokenService(signingKeyService, configService);

      expect(service.getResetTokenExpiry()).toEqual(
        new Date('2026-09-22T13:00:00.000Z'),
      );

      jest.useRealTimers();
    });
  });
});
