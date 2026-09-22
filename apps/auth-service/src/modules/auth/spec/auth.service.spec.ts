import {
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';

import AuthService from '../auth.service';
import ChangePasswordDto from '../dto/change-password.dto';
import ForgotPasswordDto from '../dto/forgot-password.dto';
import LoginDto from '../dto/login.dto';
import RegisterDto from '../dto/register.dto';
import ResetPasswordDto from '../dto/reset-password.dto';
import PasswordService from '../services/password.service';
import TokenService from '../services/token.service';
import UsersService from '../../users/users.service';
import UserEntity from '../../users/entities/user.entity';
import { UserRoleEnum } from '../../users/users.enum';

describe('AuthService', () => {
  let service: AuthService;

  let usersService: jest.Mocked<UsersService>;
  let passwordService: jest.Mocked<PasswordService>;
  let tokenService: jest.Mocked<TokenService>;

  const user = {
    id: 1,
    email: 'john@example.com',
    password: 'hashed-password',
    firstName: 'John',
    lastName: 'Doe',
    role: UserRoleEnum.CUSTOMER,
    tokenVersion: 0,
    isActive: true,
  } as UserEntity;

  const userWithoutPassword = {
    ...user,
    password: undefined,
  } as unknown as UserEntity;

  const accessTokenResponse = {
    accessToken: 'access-token',
    user: userWithoutPassword,
  };

  beforeEach(() => {
    usersService = {
      findByEmail: jest.fn(),
      findByIdWithPassword: jest.fn(),
      findByValidResetToken: jest.fn(),
      findByIdOrFail: jest.fn(),
      create: jest.fn(),
      setPasswordResetToken: jest.fn(),
      resetPassword: jest.fn(),
      changePassword: jest.fn(),
      incrementTokenVersion: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    passwordService = {
      hash: jest.fn(),
      compare: jest.fn(),
    } as unknown as jest.Mocked<PasswordService>;

    tokenService = {
      generateTokens: jest.fn(),
      generateResetToken: jest.fn(),
      hashResetToken: jest.fn(),
      getResetTokenExpiry: jest.fn(),
    } as unknown as jest.Mocked<TokenService>;

    service = new AuthService(
      usersService,
      passwordService,
      tokenService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const dto: RegisterDto = {
      email: 'john@example.com',
      password: 'Password123!',
      firstName: 'John',
      lastName: 'Doe',
    };

    it('creates a user with a hashed password and returns tokens', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      passwordService.hash.mockResolvedValue('hashed-password');

      usersService.create.mockResolvedValue(user);

      tokenService.generateTokens.mockReturnValue(accessTokenResponse);

      const result = await service.register(dto);

      expect(usersService.findByEmail).toHaveBeenCalledWith(dto.email);

      expect(passwordService.hash).toHaveBeenCalledWith(dto.password);

      expect(usersService.create).toHaveBeenCalledWith({
        ...dto,
        password: 'hashed-password',
      });

      expect(tokenService.generateTokens).toHaveBeenCalledWith(user);

      expect(result).toBe(accessTokenResponse);
    });

    it('throws ConflictException when email already exists', async () => {
      usersService.findByEmail.mockResolvedValue(user);

      await expect(service.register(dto)).rejects.toThrow(
        new ConflictException('Email is already registered'),
      );

      expect(passwordService.hash).not.toHaveBeenCalled();
      expect(usersService.create).not.toHaveBeenCalled();
      expect(tokenService.generateTokens).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const dto: LoginDto = {
      email: 'john@example.com',
      password: 'Password123!',
    };

    it('authenticates a valid user and returns tokens', async () => {
      usersService.findByEmail.mockResolvedValue(user);

      usersService.findByIdWithPassword.mockResolvedValue(user);

      passwordService.compare.mockResolvedValue(true);

      tokenService.generateTokens.mockReturnValue(accessTokenResponse);

      const result = await service.login(dto);

      expect(usersService.findByEmail).toHaveBeenCalledWith(dto.email);

      expect(usersService.findByIdWithPassword).toHaveBeenCalledWith(
        user.id,
      );

      expect(passwordService.compare).toHaveBeenCalledWith(
        dto.password,
        user.password,
      );

      expect(tokenService.generateTokens).toHaveBeenCalledWith(user);

      expect(result).toBe(accessTokenResponse);
    });

    it('throws UnauthorizedException when email does not exist', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(
        new UnauthorizedException('Invalid email or password'),
      );

      expect(usersService.findByIdWithPassword).not.toHaveBeenCalled();
      expect(passwordService.compare).not.toHaveBeenCalled();
      expect(tokenService.generateTokens).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when account is inactive', async () => {
      usersService.findByEmail.mockResolvedValue(user);

      usersService.findByIdWithPassword.mockResolvedValue({
        ...user,
        isActive: false,
      });

      await expect(service.login(dto)).rejects.toThrow(
        new UnauthorizedException('Account is deactivated'),
      );

      expect(passwordService.compare).not.toHaveBeenCalled();
      expect(tokenService.generateTokens).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when password is incorrect', async () => {
      usersService.findByEmail.mockResolvedValue(user);

      usersService.findByIdWithPassword.mockResolvedValue(user);

      passwordService.compare.mockResolvedValue(false);

      await expect(service.login(dto)).rejects.toThrow(
        new UnauthorizedException('Invalid email or password'),
      );

      expect(tokenService.generateTokens).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    const dto: ResetPasswordDto = {
      token: 'raw-reset-token',
      newPassword: 'NewPassword123!',
    };

    it('resets the password using a valid reset token', async () => {
      tokenService.hashResetToken.mockReturnValue('hashed-reset-token');

      usersService.findByValidResetToken.mockResolvedValue(user);

      passwordService.hash.mockResolvedValue('new-hashed-password');

      usersService.resetPassword.mockResolvedValue();

      const result = await service.resetPassword(dto);

      expect(tokenService.hashResetToken).toHaveBeenCalledWith(
        dto.token,
      );

      expect(usersService.findByValidResetToken).toHaveBeenCalledWith(
        'hashed-reset-token',
      );

      expect(passwordService.hash).toHaveBeenCalledWith(
        dto.newPassword,
      );

      expect(usersService.resetPassword).toHaveBeenCalledWith(
        user.id,
        'new-hashed-password',
      );

      expect(result).toEqual({
        message: 'Password has been reset successfully',
      });
    });

    it('throws UnauthorizedException when reset token is invalid or expired', async () => {
      tokenService.hashResetToken.mockReturnValue('hashed-reset-token');

      usersService.findByValidResetToken.mockResolvedValue(null);

      await expect(service.resetPassword(dto)).rejects.toThrow(
        new UnauthorizedException('Invalid or expired reset token'),
      );

      expect(passwordService.hash).not.toHaveBeenCalled();
      expect(usersService.resetPassword).not.toHaveBeenCalled();
    });
  });

  describe('forgetPassword', () => {
    const dto: ForgotPasswordDto = {
      email: 'john@example.com',
    };

    it('creates and stores a password reset token for an existing user', async () => {
      const expiresAt = new Date('2026-09-22T14:00:00.000Z');

      usersService.findByEmail.mockResolvedValue(user);

      tokenService.generateResetToken.mockReturnValue('raw-reset-token');

      tokenService.hashResetToken.mockReturnValue('hashed-reset-token');

      tokenService.getResetTokenExpiry.mockReturnValue(expiresAt);

      usersService.setPasswordResetToken.mockResolvedValue();

      const result = await service.forgetPassword(dto);

      expect(usersService.findByEmail).toHaveBeenCalledWith(
        dto.email,
      );

      expect(tokenService.generateResetToken).toHaveBeenCalled();

      expect(tokenService.hashResetToken).toHaveBeenCalledWith(
        'raw-reset-token',
      );

      expect(tokenService.getResetTokenExpiry).toHaveBeenCalled();

      expect(usersService.setPasswordResetToken).toHaveBeenCalledWith(
        user.id,
        {
          tokenHash: 'hashed-reset-token',
          expiresAt,
        },
      );

      expect(result).toEqual({
        message:
          'If an account exists with this email, password reset instructions have been sent.',
      });
    });

    it('returns the same response when the email does not exist', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await service.forgetPassword(dto);

      expect(result).toEqual({
        message:
          'If an account exists with this email, password reset instructions have been sent.',
      });

      expect(tokenService.generateResetToken).not.toHaveBeenCalled();
      expect(tokenService.hashResetToken).not.toHaveBeenCalled();
      expect(usersService.setPasswordResetToken).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    const dto: ChangePasswordDto = {
      currentPassword: 'CurrentPassword123!',
      newPassword: 'NewPassword123!',
    };

    it('changes the password when the current password is correct', async () => {
      usersService.findByIdWithPassword.mockResolvedValue(user);

      passwordService.compare.mockResolvedValue(true);

      passwordService.hash.mockResolvedValue('new-hashed-password');

      usersService.changePassword.mockResolvedValue();

      const result = await service.changePassword(user.id, dto);

      expect(usersService.findByIdWithPassword).toHaveBeenCalledWith(
        user.id,
      );

      expect(passwordService.compare).toHaveBeenCalledWith(
        dto.currentPassword,
        user.password,
      );

      expect(passwordService.hash).toHaveBeenCalledWith(
        dto.newPassword,
      );

      expect(usersService.changePassword).toHaveBeenCalledWith(
        user.id,
        'new-hashed-password',
      );

      expect(result).toEqual({
        message: 'Password changed successfully',
      });
    });

    it('throws UnauthorizedException when current password is incorrect', async () => {
      usersService.findByIdWithPassword.mockResolvedValue(user);

      passwordService.compare.mockResolvedValue(false);

      await expect(
        service.changePassword(user.id, dto),
      ).rejects.toThrow(
        new UnauthorizedException('Current password is incorrect'),
      );

      expect(passwordService.hash).not.toHaveBeenCalled();
      expect(usersService.changePassword).not.toHaveBeenCalled();
    });
  });

  describe('me', () => {
    it('returns the authenticated user', async () => {
      usersService.findByIdOrFail.mockResolvedValue(user);

      const result = await service.me(user.id);

      expect(usersService.findByIdOrFail).toHaveBeenCalledWith(
        user.id,
      );

      expect(result).toBe(user);
    });
  });

  describe('logout', () => {
    it('increments the token version', async () => {
      usersService.incrementTokenVersion.mockResolvedValue();

      const result = await service.logout(user.id);

      expect(usersService.incrementTokenVersion).toHaveBeenCalledWith(
        user.id,
      );

      expect(result).toEqual({
        message: 'Logged out successfully',
      });
    });
  });
});
