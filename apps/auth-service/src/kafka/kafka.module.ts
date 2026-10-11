import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import KafkaProducerService from './kafka-producer.service';

@Module({
  imports: [ConfigModule],
  providers: [KafkaProducerService],
  exports: [KafkaProducerService],
})
class KafkaModule {}

export default KafkaModule;
