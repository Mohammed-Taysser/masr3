import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import HealthModule from './health/health.module';
import AppConfigModule from './config/config.module';
import DatabaseModule from './database/database.module';
import AuthModule from './modules/auth/auth.module';
import JwtAuthGuard from './modules/auth/guards/jwt-auth.guard';
import UsersModule from './modules/users/users.module';
import AppThrottlerModule from './throttling/AppThrottlerModule.module';

@Module({
  imports: [
    AppConfigModule,
    AppThrottlerModule,
    DatabaseModule,
    AuthModule,
    UsersModule,
    HealthModule,
  ],
  controllers: [],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export default class AppModule {}
