import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import AuditModule from '../audit/audit.module';
import TripStatusHistoryEntity from './entities/trip-status-history.entity';
import TripEntity from './entities/trip.entity';
import TripExpiryProcessor from './trip-expiry.processor';
import TripExpiryService from './trip-expiry.service';
import { TRIP_EXPIRY_QUEUE } from './trip.constant';
import TripController from './trip.controller';
import TripService from './trip.service';

@Module({
  imports: [
    AuditModule,
    TypeOrmModule.forFeature([TripEntity, TripStatusHistoryEntity]),
    BullModule.registerQueue({ name: TRIP_EXPIRY_QUEUE }),
  ],
  controllers: [TripController],
  providers: [TripService, TripExpiryService, TripExpiryProcessor],
  exports: [TripService],
})
class TripModule {}

export default TripModule;
