import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { DynamicModule, Module } from '@nestjs/common';

import KafkaProducerModule from '../kafka/kafka-producer.module';
import { OUTBOX_RELAY_QUEUE, QUEUE_NAME_PATTERN } from './outbox.constant';
import { OutboxModuleOptions } from './outbox.interface';
import { createOutboxRelayProcessor } from './outbox-relay.processor';
import OutboxRelayService from './outbox-relay.service';
import OutboxService from './outbox.service';

// The transactional outbox (docs/patterns/transactional-outbox.md). Register
// it once, in AppModule; it is global, so any feature can inject
// OutboxService. The service also lists OutboxEventEntity in its DataSource
// and validates OUTBOX_RELAY_LOCK_ID and the other OUTBOX_* variables.
@Module({})
class OutboxModule {
  static forRoot(options: OutboxModuleOptions): DynamicModule {
    if (!QUEUE_NAME_PATTERN.test(options.queue)) {
      throw new Error(
        `Outbox relay queue "${options.queue}" must be lowercase kebab-case, prefixed with the service`,
      );
    }

    return {
      module: OutboxModule,
      global: true,
      imports: [
        KafkaProducerModule,
        BullModule.registerQueue({ name: options.queue }),
      ],
      providers: [
        {
          provide: OUTBOX_RELAY_QUEUE,
          useExisting: getQueueToken(options.queue),
        },
        OutboxService,
        OutboxRelayService,
        createOutboxRelayProcessor(options.queue),
      ],
      exports: [OutboxService],
    };
  }
}

export default OutboxModule;
