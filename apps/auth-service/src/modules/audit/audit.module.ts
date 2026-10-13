import { Module } from '@nestjs/common';

import OutboxModule from '../outbox/outbox.module';
import AuditRecorderService from './audit-recorder.service';

@Module({
  imports: [OutboxModule],
  providers: [AuditRecorderService],
  exports: [AuditRecorderService],
})
class AuditModule {}

export default AuditModule;
