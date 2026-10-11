import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import OutboxModule from '../outbox/outbox.module';
import TripOfferEntity from './entities/trip-offer.entity';
import TripStatusHistoryEntity from './entities/trip-status-history.entity';
import TripEntity from './entities/trip.entity';
import TripOfferController from './trip-offer.controller';
import TripOfferService from './trip-offer.service';
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
  ],
  controllers: [TripController, TripOfferController],
  providers: [TripService, TripOfferService],
  exports: [TripService],
})
class TripModule {}

export default TripModule;
