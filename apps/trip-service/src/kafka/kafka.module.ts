import { Module } from '@nestjs/common';

import KafkaProducerService from './kafka-producer.service';

@Module({
  providers: [KafkaProducerService],
  exports: [KafkaProducerService],
})
class KafkaModule {}

export default KafkaModule;
