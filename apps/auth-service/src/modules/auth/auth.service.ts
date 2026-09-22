import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import RegisterDto from './dto/register.dto';
import LoginDto from './dto/login.dto';
import ResetPasswordDto from './dto/reset-password.dto';
import ChangePasswordDto from './dto/change-password.dto';
import ForgotPasswordDto from './dto/forgot-password.dto';

import UsersService from '../users/users.service';
import PasswordService from './services/password.service';
import TokenService from './services/token.service';

@Injectable()
class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(dto.email);

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const hashedPassword = await this.passwordService.hash(dto.password);

    const user = await this.usersService.create({
      ...dto,
      password: hashedPassword,
    });

    return this.tokenService.generateTokens(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const userWithPassword = await this.usersService.findByIdWithPassword(
      user.id,
    );

    if (!userWithPassword.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const passwordMatches = await this.passwordService.compare(
      dto.password,
      userWithPassword.password,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.tokenService.generateTokens(userWithPassword);
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = this.tokenService.hashResetToken(dto.token);

    const user = await this.usersService.findByValidResetToken(tokenHash);

    if (!user) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const hashedPassword = await this.passwordService.hash(dto.newPassword);

    await this.usersService.resetPassword(user.id, hashedPassword);

    return {
      message: 'Password has been reset successfully',
    };
  }

  async forgetPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      return {
        message:
          'If an account exists with this email, password reset instructions have been sent.',
      };
    }

    const resetToken = this.tokenService.generateResetToken();
    const tokenHash = this.tokenService.hashResetToken(resetToken);

    await this.usersService.setPasswordResetToken(user.id, {
      tokenHash,
      expiresAt: this.tokenService.getResetTokenExpiry(),
    });

    return {
      message:
        'If an account exists with this email, password reset instructions have been sent.',
    };
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.usersService.findByIdWithPassword(userId);

    const passwordMatches = await this.passwordService.compare(
      dto.currentPassword,
      user.password,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedPassword = await this.passwordService.hash(dto.newPassword);

    await this.usersService.changePassword(user.id, hashedPassword);

    return {
      message: 'Password changed successfully',
    };
  }

  async me(userId: number) {
    return this.usersService.findByIdOrFail(userId);
  }

  async logout(userId: number) {
    await this.usersService.incrementTokenVersion(userId);

    return {
      message: 'Logged out successfully',
    };
  }
}

export default AuthService;
