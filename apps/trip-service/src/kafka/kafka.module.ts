import { Module } from '@nestjs/common';

import UserModule from '../modules/user/user.module';
import KafkaConsumerService from './kafka-consumer.service';

@Module({
  imports: [UserModule],
  providers: [KafkaConsumerService],
})
class KafkaModule {}

export default KafkaModule;
