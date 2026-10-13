import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import AuditModule from '../modules/audit/audit.module';
import KafkaConsumerService from './kafka-consumer.service';

@Module({
  imports: [ConfigModule, AuditModule],
  providers: [KafkaConsumerService],
})
class KafkaModule {}

export default KafkaModule;
