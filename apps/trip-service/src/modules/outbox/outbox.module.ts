import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import KafkaModule from '../../kafka/kafka.module';
import OutboxEventEntity from './entities/outbox-event.entity';
import OutboxRelayProcessor from './outbox-relay.processor';
import OutboxRelayService from './outbox-relay.service';
import { OUTBOX_RELAY_QUEUE } from './outbox.constant';
import OutboxService from './outbox.service';

@Module({
  imports: [
    KafkaModule,
    TypeOrmModule.forFeature([OutboxEventEntity]),
    BullModule.registerQueue({ name: OUTBOX_RELAY_QUEUE }),
  ],
  providers: [OutboxService, OutboxRelayService, OutboxRelayProcessor],
  exports: [OutboxService],
})
class OutboxModule {}

export default OutboxModule;
