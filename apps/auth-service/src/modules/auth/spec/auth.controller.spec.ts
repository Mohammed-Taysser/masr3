import AuthController from '../auth.controller';
import AuthService from '../auth.service';

import RegisterDto from '../dto/register.dto';
import LoginDto from '../dto/login.dto';
import ForgotPasswordDto from '../dto/forgot-password.dto';
import ResetPasswordDto from '../dto/reset-password.dto';
import ChangePasswordDto from '../dto/change-password.dto';
import UserEntity from '../../users/entities/user.entity';
import { UserRoleEnum } from '../../users/users.enum';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const authResponse = {
    accessToken: 'access-token',
    user: {
      id: 1,
      email: 'john@example.com',
      role: UserRoleEnum.CUSTOMER,
      firstName: 'John',
      lastName: 'Doe',
      tokenVersion: 0,
      isActive: true,
    } as UserEntity,
  };

  beforeEach(() => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      forgetPassword: jest.fn(),
      resetPassword: jest.fn(),
      changePassword: jest.fn(),
      me: jest.fn(),
      logout: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    controller = new AuthController(authService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('passes the DTO to AuthService and returns the result', async () => {
      const dto: RegisterDto = {
        email: 'john@example.com',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe',
      };

      authService.register.mockResolvedValue(authResponse);

      const result = await controller.register(dto);

      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(result).toBe(authResponse);
    });
  });

  describe('login', () => {
    it('passes the DTO to AuthService and returns the result', async () => {
      const dto: LoginDto = {
        email: 'john@example.com',
        password: 'Password123!',
      };

      authService.login.mockResolvedValue(authResponse);

      const result = await controller.login(dto);

      expect(authService.login).toHaveBeenCalledWith(dto);
      expect(result).toBe(authResponse);
    });
  });

  describe('forgotPassword', () => {
    it('passes the DTO to AuthService and returns the result', async () => {
      const dto: ForgotPasswordDto = {
        email: 'john@example.com',
      };

      const response = {
        message:
          'If an account exists with this email, password reset instructions have been sent.',
      };

      authService.forgetPassword.mockResolvedValue(response);

      const result = await controller.forgotPassword(dto);

      expect(authService.forgetPassword).toHaveBeenCalledWith(dto);
      expect(result).toBe(response);
    });
  });

  describe('resetPassword', () => {
    it('passes the DTO to AuthService and returns the result', async () => {
      const dto: ResetPasswordDto = {
        token: 'raw-reset-token',
        newPassword: 'NewPassword123!',
      };

      const response = {
        message: 'Password has been reset successfully',
      };

      authService.resetPassword.mockResolvedValue(response);

      const result = await controller.resetPassword(dto);

      expect(authService.resetPassword).toHaveBeenCalledWith(dto);
      expect(result).toBe(response);
    });
  });

  describe('changePassword', () => {
    it('passes the authenticated user ID and DTO to AuthService', async () => {
      const userId = 1;

      const dto: ChangePasswordDto = {
        currentPassword: 'CurrentPassword123!',
        newPassword: 'NewPassword123!',
      };

      const response = {
        message: 'Password changed successfully',
      };

      authService.changePassword.mockResolvedValue(response);

      const request = {
        user: {
          id: userId,
        },
      } as any;

      const result = await controller.changePassword(request, dto);

      expect(authService.changePassword).toHaveBeenCalledWith(userId, dto);

      expect(result).toBe(response);
    });
  });

  describe('me', () => {
    it('passes the authenticated user ID to AuthService', async () => {
      const userId = 1;

      const user = {
        id: userId,
        email: 'john@example.com',
      };

      authService.me.mockResolvedValue(user as never);

      const request = {
        user: {
          id: userId,
        },
      } as any;

      const result = await controller.me(request);

      expect(authService.me).toHaveBeenCalledWith(userId);
      expect(result).toBe(user);
    });
  });

  describe('logout', () => {
    it('passes the authenticated user ID to AuthService', async () => {
      const userId = 1;

      const response = {
        message: 'Logged out successfully',
      };

      authService.logout.mockResolvedValue(response);

      const request = {
        user: {
          id: userId,
        },
      } as any;

      const result = await controller.logout(request);

      expect(authService.logout).toHaveBeenCalledWith(userId);
      expect(result).toBe(response);
    });
  });
});
