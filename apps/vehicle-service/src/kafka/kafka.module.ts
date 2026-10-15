import { Module } from '@nestjs/common';

import DriverModule from '../modules/driver/driver.module';
import KafkaConsumerService from './kafka-consumer.service';

@Module({
  imports: [DriverModule],
  providers: [KafkaConsumerService],
})
class KafkaModule {}

export default KafkaModule;
