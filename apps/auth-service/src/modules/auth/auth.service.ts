import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  BEARER_TOKEN_TYPE,
  REFRESH_TOKEN_AUDIENCE,
  TokenUseEnum,
  TokenVerifierService,
} from '@masr3/libs/auth';
import {
  AuthKafkaTopic,
  BaseAuthEvent,
  buildUserAuditActor,
  EventPayload,
} from '@masr3/libs/kafka';

import ChangePasswordDto from './dto/change-password.dto';
import ForgotPasswordDto from './dto/forgot-password.dto';
import LoginDto from './dto/login.dto';
import RefreshTokenDto from './dto/refresh-token.dto';
import RegisterDto from './dto/register.dto';
import ResetPasswordDto from './dto/reset-password.dto';

import KafkaProducerService from '../../kafka/kafka-producer.service';
import UserEntity from '../users/entities/user.entity';
import UsersService from '../users/users.service';
import AccessTokenResponseDto from './dto/access-token-response.dto';
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
    private readonly tokenVerifier: TokenVerifierService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existingUser = await this.usersService.findByEmail(dto.email);

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const hashedPassword = await this.passwordService.hash(dto.password);

    const user = await this.usersService.register({
      ...dto,
      password: hashedPassword,
    });

    await this.kafkaProducer.publish(
      AuthKafkaTopic.USER_REGISTER,
      this.buildEvent(user),
    );

    return this.buildAuthResponse(user);
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

    await this.usersService.recordLogin(user);

    await this.kafkaProducer.publish(
      AuthKafkaTopic.USER_LOGGED_IN,
      this.buildEvent(user),
    );

    return this.buildAuthResponse(user);
  }

  async refresh(dto: RefreshTokenDto): Promise<AccessTokenResponseDto> {
    const claims = await this.tokenVerifier.verify(
      dto.refreshToken,
      TokenUseEnum.REFRESH,
      REFRESH_TOKEN_AUDIENCE,
    );

    const user = await this.usersService.findById(Number(claims.sub));

    const isTokenCurrent =
      user?.isActive === true && user.tokenVersion === claims.tokenVersion;

    if (!isTokenCurrent) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.buildAccessTokenResponse(user);
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = this.tokenService.hashToken(dto.token);

    const user = await this.usersService.findByValidResetToken(tokenHash);

    if (!user) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const hashedPassword = await this.passwordService.hash(dto.newPassword);

    await this.usersService.resetPassword(
      user.id,
      hashedPassword,
      buildUserAuditActor(user),
    );

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

    await this.usersService.changePassword(
      user.id,
      hashedPassword,
      buildUserAuditActor(user),
    );

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

    await this.usersService.logout(userId, buildUserAuditActor(user));

    await this.kafkaProducer.publish(
      AuthKafkaTopic.USER_LOGGED_OUT,
      this.buildEvent(user),
    );

    return {
      message: 'Logged out successfully',
    };
  }

  private buildAccessTokenResponse(user: UserEntity): AccessTokenResponseDto {
    return {
      accessToken: this.tokenService.generateAccessToken(user),
      tokenType: BEARER_TOKEN_TYPE,
      expiresIn: this.tokenService.ACCESS_TOKEN_EXPIRES_IN_SECONDS,
    };
  }

  private buildAuthResponse(user: UserEntity): AuthResponseDto {
    return {
      ...this.buildAccessTokenResponse(user),
      refreshToken: this.tokenService.generateRefreshToken(user),
      user,
    };
  }

  private buildEvent(user: UserEntity): EventPayload<BaseAuthEvent> {
    return {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
    };
  }
}

export default AuthService;
