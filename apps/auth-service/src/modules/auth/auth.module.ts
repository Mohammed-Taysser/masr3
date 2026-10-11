import { Module } from '@nestjs/common';

import KafkaModule from '../../kafka/kafka.module';
import SigningKeyModule from '../signing-key/signing-key.module';
import UsersModule from '../users/users.module';
import AuthController from './auth.controller';
import AuthService from './auth.service';
import PasswordService from './services/password.service';
import TokenService from './services/token.service';

@Module({
  imports: [UsersModule, KafkaModule, SigningKeyModule],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService],
  exports: [AuthService],
})
class AuthModule {}

export default AuthModule;
