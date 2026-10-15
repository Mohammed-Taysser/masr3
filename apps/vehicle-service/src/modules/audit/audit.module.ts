import { Module } from '@nestjs/common';

import AuditRecorderService from './audit-recorder.service';

@Module({
  providers: [AuditRecorderService],
  exports: [AuditRecorderService],
})
class AuditModule {}

export default AuditModule;
