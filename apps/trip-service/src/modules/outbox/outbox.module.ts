import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import KafkaModule from '../../kafka/kafka.module';
import OutboxEventEntity from './entities/outbox-event.entity';
import OutboxRelayService from './outbox-relay.service';
import OutboxService from './outbox.service';

@Module({
  imports: [KafkaModule, TypeOrmModule.forFeature([OutboxEventEntity])],
  providers: [OutboxService, OutboxRelayService],
  exports: [OutboxService],
})
class OutboxModule {}

export default OutboxModule;
