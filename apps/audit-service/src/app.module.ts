import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AuthenticationGuard, AuthenticationModule } from '@masr3/libs';

import AppConfigModule from './config/config.module';
import DatabaseModule from './database/database.module';
import HealthModule from './health/health.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    AuthenticationModule.register(),
    HealthModule,
  ],
  controllers: [],
  providers: [{ provide: APP_GUARD, useExisting: AuthenticationGuard }],
})
export default class AppModule {}
