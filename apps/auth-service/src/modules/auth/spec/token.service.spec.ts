import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';

import TokenService from '../services/token.service';
import UserEntity from '../../users/entities/user.entity';
import { UserRoleEnum } from '../../users/users.enum';

describe('TokenService', () => {
  let service: TokenService;
  let jwtService: jest.Mocked<JwtService>;

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

    service = new TokenService(jwtService);
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

    it('returns the signed access token alongside the user', () => {
      jwtService.sign.mockReturnValue('signed-token');

      const result = service.generateTokens(user);

      expect(result).toEqual({
        accessToken: 'signed-token',
        user,
      });
    });
  });

  describe('generateResetToken', () => {
    it('returns a 64-character hex string', () => {
      const token = service.generateResetToken();

      expect(token).toMatch(/^[a-f0-9]{64}$/);
    });

    it('returns a different token on each call', () => {
      const first = service.generateResetToken();
      const second = service.generateResetToken();

      expect(first).not.toBe(second);
    });
  });

  describe('hashResetToken', () => {
    it('returns the sha256 hex digest of the input', () => {
      const expected = createHash('sha256')
        .update('raw-token')
        .digest('hex');

      expect(service.hashResetToken('raw-token')).toBe(expected);
    });

    it('produces the same hash for the same input', () => {
      expect(service.hashResetToken('same')).toBe(
        service.hashResetToken('same'),
      );
    });

    it('produces different hashes for different input', () => {
      expect(service.hashResetToken('a')).not.toBe(
        service.hashResetToken('b'),
      );
    });
  });

  describe('getResetTokenExpiry', () => {
    it('returns a date 15 minutes in the future', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-22T12:00:00.000Z'));

      const expiresAt = service.getResetTokenExpiry();

      expect(expiresAt).toEqual(new Date('2026-09-22T12:15:00.000Z'));

      jest.useRealTimers();
    });
  });
});
