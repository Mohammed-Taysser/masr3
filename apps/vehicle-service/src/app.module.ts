import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AuthenticationGuard, AuthenticationModule } from '@masr3/libs/auth';
import { OutboxModule } from '@masr3/libs/outbox';

import AppConfigModule from './config/config.module';
import DatabaseModule from './database/database.module';
import HealthModule from './health/health.module';
import { VEHICLE_OUTBOX_RELAY_QUEUE } from './kafka/kafka.constant';
import KafkaModule from './kafka/kafka.module';
import QueueModule from './queue/queue.module';
import VehicleModule from './modules/vehicle/vehicle.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    QueueModule,
    OutboxModule.forRoot({ queue: VEHICLE_OUTBOX_RELAY_QUEUE }),
    KafkaModule,
    AuthenticationModule.register(),
    VehicleModule,
    HealthModule,
  ],
  controllers: [],
  providers: [{ provide: APP_GUARD, useExisting: AuthenticationGuard }],
})
export default class AppModule {}
