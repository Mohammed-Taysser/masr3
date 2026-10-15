import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AuthenticationGuard, AuthenticationModule } from '@masr3/libs/auth';
import { OutboxModule } from '@masr3/libs/outbox';

import AppConfigModule from './config/config.module';
import DatabaseModule from './database/database.module';
import HealthModule from './health/health.module';
import KafkaModule from './kafka/kafka.module';
import KafkaProducerService from './kafka/kafka-producer.service';
import QueueModule from './queue/queue.module';
import TripOfferModule from './modules/trip-offer/trip-offer.module';
import TripModule from './modules/trip/trip.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    QueueModule,
    OutboxModule.forRoot({
      imports: [KafkaModule],
      producer: KafkaProducerService,
    }),
    AuthenticationModule.register(),
    TripModule,
    TripOfferModule,
    HealthModule,
  ],
  controllers: [],
  providers: [{ provide: APP_GUARD, useExisting: AuthenticationGuard }],
})
export default class AppModule {}
