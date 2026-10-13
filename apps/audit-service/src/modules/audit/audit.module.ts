import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import AuditController from './audit.controller';
import AuditService from './audit.service';
import AuditEntity from './entities/audit.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AuditEntity])],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
class AuditModule {}

export default AuditModule;
