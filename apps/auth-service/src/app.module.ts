import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

import { AuthenticationGuard, AuthenticationModule } from '@masr3/libs/auth';
import { OutboxModule } from '@masr3/libs/outbox';

import AppConfigModule from './config/config.module';
import DatabaseModule from './database/database.module';
import HealthModule from './health/health.module';
import { AUTH_OUTBOX_RELAY_QUEUE } from './kafka/kafka.constant';
import QueueModule from './queue/queue.module';
import AuthModule from './modules/auth/auth.module';
import ServiceClientModule from './modules/service-client/service-client.module';
import LocalKeyResolver from './modules/signing-key/local-key.resolver';
import SigningKeyModule from './modules/signing-key/signing-key.module';
import ActiveUserValidator from './modules/users/active-user.validator';
import UsersModule from './modules/users/users.module';
import AppThrottlerModule from './throttling/AppThrottlerModule.module';

@Module({
  imports: [
    AppConfigModule,
    AppThrottlerModule,
    DatabaseModule,
    QueueModule,
    OutboxModule.forRoot({ queue: AUTH_OUTBOX_RELAY_QUEUE }),
    AuthenticationModule.register({
      imports: [SigningKeyModule, UsersModule],
      keyResolver: LocalKeyResolver,
      userValidator: ActiveUserValidator,
    }),
    SigningKeyModule,
    AuthModule,
    UsersModule,
    ServiceClientModule,
    HealthModule,
  ],
  controllers: [],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: AuthenticationGuard },
  ],
})
export default class AppModule {}
