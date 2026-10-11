import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import KafkaModule from '../../kafka/kafka.module';
import UsersModule from '../users/users.module';
import AuthController from './auth.controller';
import AuthService from './auth.service';
import PasswordService from './services/password.service';
import TokenService from './services/token.service';
import JwtStrategy from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule,
    KafkaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.getOrThrow<string>(
            'JWT_EXPIRES_IN',
          ) as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService, JwtStrategy],
  exports: [AuthService],
})
class AuthModule {}

export default AuthModule;
