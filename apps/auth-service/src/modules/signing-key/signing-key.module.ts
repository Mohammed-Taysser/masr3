import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import JwksController from './jwks.controller';
import LocalKeyResolver from './local-key.resolver';
import SigningKeyService from './signing-key.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [JwksController],
  providers: [SigningKeyService, LocalKeyResolver],
  exports: [SigningKeyService, LocalKeyResolver],
})
class SigningKeyModule {}

export default SigningKeyModule;
