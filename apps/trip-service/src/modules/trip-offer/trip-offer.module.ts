import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import AuditModule from '../audit/audit.module';
import TripEntity from '../trip/entities/trip.entity';
import TripModule from '../trip/trip.module';
import TripOfferEntity from './entities/trip-offer.entity';
import TripOfferController from './trip-offer.controller';
import TripOfferService from './trip-offer.service';

@Module({
  imports: [
    AuditModule,
    TripModule,
    TypeOrmModule.forFeature([TripOfferEntity, TripEntity]),
  ],
  controllers: [TripOfferController],
  providers: [TripOfferService],
})
class TripOfferModule {}

export default TripOfferModule;
