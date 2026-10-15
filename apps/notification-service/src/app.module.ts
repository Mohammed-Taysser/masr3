import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AuthenticationGuard, AuthenticationModule } from '@masr3/libs/auth';

import AppConfigModule from './config/config.module';
import DatabaseModule from './database/database.module';
import HealthModule from './health/health.module';
import KafkaModule from './kafka/kafka.module';
import InboxModule from './modules/inbox/inbox.module';
import NotificationModule from './modules/notification/notification.module';
import PreferencesModule from './modules/preferences/preferences.module';
import QueueModule from './queue/queue.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    QueueModule,
    AuthenticationModule.register(),
    NotificationModule,
    InboxModule,
    PreferencesModule,
    KafkaModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useExisting: AuthenticationGuard }],
})
export default class AppModule {}
