import { Module } from '@nestjs/common';

import { KafkaProducerModule } from '@masr3/libs/kafka';

import KafkaPublisherService from './kafka-publisher.service';

@Module({
  imports: [KafkaProducerModule],
  providers: [KafkaPublisherService],
  exports: [KafkaPublisherService],
})
class KafkaModule {}

export default KafkaModule;
