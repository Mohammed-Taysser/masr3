import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import AuditModule from '../audit/audit.module';
import DriverModule from '../driver/driver.module';
import VehicleEntity from './entities/vehicle.entity';
import VehicleController from './vehicle.controller';
import VehicleService from './vehicle.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([VehicleEntity]),
    AuditModule,
    DriverModule,
  ],
  controllers: [VehicleController],
  providers: [VehicleService],
})
class VehicleModule {}

export default VehicleModule;
