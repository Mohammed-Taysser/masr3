import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import AppThrottlerModule from '../throttling/AppThrottlerModule.module';
import AppConfigModule from '../config/config.module';
import DatabaseModule from '../database/database.module';
import AuthModule from '../modules/auth/auth.module';
import UsersModule from '../modules/users/users.module';
import JwtAuthGuard from '../modules/auth/guards/jwt-auth.guard';

@Module({
  imports: [
    AppConfigModule,
    AppThrottlerModule,
    DatabaseModule,
    AuthModule,
    UsersModule,
  ],
  controllers: [],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export default class AppModule {}
