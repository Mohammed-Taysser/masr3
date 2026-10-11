import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import TripStatusHistoryEntity from './entities/trip-status-history.entity';
import TripEntity from './entities/trip.entity';
import TripService from './trip.service';

@Module({
  imports: [TypeOrmModule.forFeature([TripEntity, TripStatusHistoryEntity])],
  providers: [TripService],
  exports: [TripService],
})
class TripModule {}

export default TripModule;
