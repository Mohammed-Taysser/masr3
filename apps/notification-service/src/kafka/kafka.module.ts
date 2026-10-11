import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import NotificationModule from '../modules/notification/notification.module';
import KafkaConsumerService from './kafka-consumer.service';

@Module({
  imports: [ConfigModule, NotificationModule],
  providers: [KafkaConsumerService],
})
class KafkaModule {}

export default KafkaModule;
