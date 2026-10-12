import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import EventsModule from '../modules/events/events.module';
import NotificationModule from '../modules/notification/notification.module';
import KafkaConsumerService from './kafka-consumer.service';

@Module({
  imports: [ConfigModule, NotificationModule, EventsModule],
  providers: [KafkaConsumerService],
})
class KafkaModule {}

export default KafkaModule;
