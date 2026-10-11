import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { AuthKafkaTopic, BaseAuthEvent, dayjs } from '@masr3/libs';

import ChangePasswordDto from './dto/change-password.dto';
import ForgotPasswordDto from './dto/forgot-password.dto';
import LoginDto from './dto/login.dto';
import RegisterDto from './dto/register.dto';
import ResetPasswordDto from './dto/reset-password.dto';

import KafkaProducerService from '../../kafka/kafka-producer.service';
import UserEntity from '../users/entities/user.entity';
import UsersService from '../users/users.service';
import AuthResponseDto from './dto/auth-response.dto';
import PasswordService from './services/password.service';
import TokenService from './services/token.service';

@Injectable()
class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existingUser = await this.usersService.findByEmail(dto.email);

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const hashedPassword = await this.passwordService.hash(dto.password);

    const user = await this.usersService.create({
      ...dto,
      password: hashedPassword,
    });

    await this.kafkaProducer.publish(
      AuthKafkaTopic.USER_REGISTER,
      this.buildEvent(user),
    );

    const accessToken = this.tokenService.generateTokens(user);

    return {
      accessToken,
      user,
    };
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
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

    await this.kafkaProducer.publish(
      AuthKafkaTopic.USER_LOGGED_IN,
      this.buildEvent(user),
    );

    const accessToken = this.tokenService.generateTokens(user);

    return {
      accessToken,
      user,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = this.tokenService.hashToken(dto.token);

    const user = await this.usersService.findByValidResetToken(tokenHash);

    if (!user) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const hashedPassword = await this.passwordService.hash(dto.newPassword);

    await this.usersService.resetPassword(user.id, hashedPassword);

    await this.kafkaProducer.publish(
      AuthKafkaTopic.PASSWORD_RESET_COMPLETED,
      this.buildEvent(user),
    );

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

    const { token, tokenHash } = this.tokenService.createResetToken();

    const expiresAt = this.tokenService.getResetTokenExpiry();

    await this.usersService.setPasswordResetToken(user.id, {
      tokenHash,
      expiresAt,
    });

    await this.kafkaProducer.publish(AuthKafkaTopic.PASSWORD_RESET_REQUESTED, {
      ...this.buildEvent(user),
      resetToken: token,
      expiresAt: expiresAt.toISOString(),
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

    await this.kafkaProducer.publish(
      AuthKafkaTopic.USER_CHANGE_PASSWORD,
      this.buildEvent(user),
    );

    return {
      message: 'Password changed successfully',
    };
  }

  async me(userId: number) {
    return this.usersService.findByIdOrFail(userId);
  }

  async logout(userId: number) {
    const user = await this.usersService.findByIdOrFail(userId);

    await this.usersService.incrementTokenVersion(userId);

    await this.kafkaProducer.publish(
      AuthKafkaTopic.USER_LOGGED_OUT,
      this.buildEvent(user),
    );

    return {
      message: 'Logged out successfully',
    };
  }

  private buildEvent(user: UserEntity): BaseAuthEvent {
    return {
      eventId: randomUUID(),
      occurredAt: dayjs().toISOString(),
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
    };
  }
}

export default AuthService;
