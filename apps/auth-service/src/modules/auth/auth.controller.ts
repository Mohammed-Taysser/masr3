import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';

import AuthService from './auth.service';
import AuthResponseDto from './dto/auth-response.dto';
import ChangePasswordDto from './dto/change-password.dto';
import ForgotPasswordDto from './dto/forgot-password.dto';
import LoginDto from './dto/login.dto';
import RegisterDto from './dto/register.dto';
import ResetPasswordDto from './dto/reset-password.dto';
import JwtAuthGuard from './guards/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import UserResponseDto from '../users/dto/user-response.dto';

@ApiTags('Auth')
@Controller('auth')
class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ long: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Create an account and sign in',
    description:
      'Creates the user and returns a valid access token. The account is immediately usable; email verification is not implemented yet.',
  })
  @ApiCreatedResponse({
    type: AuthResponseDto,
    description: 'Account created and authenticated.',
  })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ long: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Sign in',
    description:
      'Authenticates a user using email and password and returns an access token.',
  })
  @ApiOkResponse({
    type: AuthResponseDto,
    description: 'Authentication successful.',
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ long: { limit: 3, ttl: 60000 } })
  @ApiOperation({
    summary: 'Request a password reset',
    description:
      'Creates a short-lived password reset token when the account exists. The response is identical whether the email is registered or not.',
  })
  @ApiOkResponse({
    description:
      'Password reset request accepted. The response intentionally does not reveal whether the account exists.',
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgetPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ long: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Reset password',
    description:
      'Resets the password using a valid password-reset token. Existing access tokens are revoked.',
  })
  @ApiOkResponse({
    description: 'Password reset successfully.',
  })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Change the authenticated user password',
    description:
      'Changes the current password. All existing access tokens are revoked and the user must authenticate again.',
  })
  @ApiOkResponse({
    description: 'Password changed successfully.',
  })
  changePassword(@Req() request: Request) {
    const userId = request.user.id;

    return this.authService.changePassword(userId, request.body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get the authenticated user',
  })
  @ApiOkResponse({
    description: 'Authenticated user returned.',
  })
  me(@Req() request: Request): Promise<UserResponseDto> {
    return this.authService.me(request.user.id);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Log out',
    description:
      'Increments the account token version, invalidating existing access tokens.',
  })
  @ApiOkResponse({
    description: 'Logged out successfully.',
  })
  logout(@Req() request: Request) {
    return this.authService.logout(request.user.id);
  }
}

export default AuthController;
