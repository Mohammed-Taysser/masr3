import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import JwtStrategy from '../strategies/jwt.strategy';
import UsersService from '../../users/users.service';
import UserEntity from '../../users/entities/user.entity';
import { UserRoleEnum } from '../../users/users.enum';
import { JwtPayload } from '../auth.interface';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersService: jest.Mocked<UsersService>;
  let configService: jest.Mocked<ConfigService>;

  const user = {
    id: 1,
    email: 'john@example.com',
    role: UserRoleEnum.CUSTOMER,
    tokenVersion: 2,
    isActive: true,
  } as UserEntity;

  const payload: JwtPayload = {
    sub: 1,
    email: 'john@example.com',
    role: UserRoleEnum.CUSTOMER,
    tokenVersion: 2,
  };

  beforeEach(() => {
    configService = {
      getOrThrow: jest.fn().mockReturnValue('test-secret'),
    } as unknown as jest.Mocked<ConfigService>;

    usersService = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    strategy = new JwtStrategy(configService, usersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('returns the authenticated user when the token is current', async () => {
      usersService.findById.mockResolvedValue(user);

      const result = await strategy.validate(payload);

      expect(usersService.findById).toHaveBeenCalledWith(payload.sub);

      expect(result).toEqual({
        id: user.id,
        email: user.email,
        role: user.role,
      });
    });

    it('throws UnauthorizedException when sub is missing', async () => {
      await expect(
        strategy.validate({
          ...payload,
          sub: undefined as unknown as number,
        }),
      ).rejects.toThrow(new UnauthorizedException('Invalid access token'));

      expect(usersService.findById).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the user no longer exists', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow(
        new UnauthorizedException('Invalid access token'),
      );
    });

    it('throws UnauthorizedException when the account is deactivated', async () => {
      usersService.findById.mockResolvedValue({ ...user, isActive: false });

      await expect(strategy.validate(payload)).rejects.toThrow(
        new UnauthorizedException('Invalid access token'),
      );
    });

    it('throws UnauthorizedException when the token version is stale', async () => {
      usersService.findById.mockResolvedValue({ ...user, tokenVersion: 3 });

      await expect(strategy.validate(payload)).rejects.toThrow(
        new UnauthorizedException('Invalid access token'),
      );
    });
  });
});
