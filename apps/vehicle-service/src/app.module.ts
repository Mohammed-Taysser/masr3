import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AuthenticationGuard, AuthenticationModule } from '@masr3/libs/auth';
import { OutboxModule } from '@masr3/libs/outbox';

import AppConfigModule from './config/config.module';
import DatabaseModule from './database/database.module';
import HealthModule from './health/health.module';
import KafkaProducerService from './kafka/kafka-producer.service';
import KafkaModule from './kafka/kafka.module';
import QueueModule from './queue/queue.module';
import VehicleModule from './modules/vehicle/vehicle.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    QueueModule,
    OutboxModule.forRoot({
      imports: [KafkaModule],
      producer: KafkaProducerService,
    }),
    KafkaModule,
    AuthenticationModule.register(),
    VehicleModule,
    HealthModule,
  ],
  controllers: [],
  providers: [{ provide: APP_GUARD, useExisting: AuthenticationGuard }],
})
export default class AppModule {}
