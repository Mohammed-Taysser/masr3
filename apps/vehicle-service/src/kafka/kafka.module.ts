import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import DriverModule from '../modules/driver/driver.module';
import KafkaConsumerService from './kafka-consumer.service';
import KafkaProducerService from './kafka-producer.service';

@Module({
  imports: [ConfigModule, DriverModule],
  providers: [KafkaProducerService, KafkaConsumerService],
  exports: [KafkaProducerService],
})
class KafkaModule {}

export default KafkaModule;
