import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import OutboxModule from '../outbox/outbox.module';
import TripOfferEntity from './entities/trip-offer.entity';
import TripStatusHistoryEntity from './entities/trip-status-history.entity';
import TripEntity from './entities/trip.entity';
import TripExpiryProcessor from './trip-expiry.processor';
import TripExpiryService from './trip-expiry.service';
import TripOfferController from './trip-offer.controller';
import TripOfferService from './trip-offer.service';
import { TRIP_EXPIRY_QUEUE } from './trip.constant';
import TripController from './trip.controller';
import TripService from './trip.service';

@Module({
  imports: [
    OutboxModule,
    TypeOrmModule.forFeature([
      TripEntity,
      TripStatusHistoryEntity,
      TripOfferEntity,
    ]),
    BullModule.registerQueue({ name: TRIP_EXPIRY_QUEUE }),
  ],
  controllers: [TripController, TripOfferController],
  providers: [
    TripService,
    TripOfferService,
    TripExpiryService,
    TripExpiryProcessor,
  ],
  exports: [TripService],
})
class TripModule {}

export default TripModule;
