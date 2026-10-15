import { Module } from '@nestjs/common';

import { ServiceTokenModule } from '@masr3/libs/auth';

import AuthServiceClient from './auth-service.client';

@Module({
  imports: [ServiceTokenModule],
  providers: [AuthServiceClient],
  exports: [AuthServiceClient],
})
class AuthServiceClientModule {}

export default AuthServiceClientModule;
