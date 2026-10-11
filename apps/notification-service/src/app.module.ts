import { Module } from '@nestjs/common';
import AppConfigModule from './config/config.module';
import DatabaseModule from './database/database.module';
import HealthModule from './health/health.module';
import KafkaModule from './kafka/kafka.module';
import NotificationModule from './modules/notification/notification.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    NotificationModule,
    KafkaModule,
    HealthModule,
  ],
  controllers: [],
  providers: [],
})
export default class AppModule {}
