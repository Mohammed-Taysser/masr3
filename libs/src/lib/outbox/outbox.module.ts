import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { OUTBOX_PRODUCER, OUTBOX_RELAY_QUEUE } from './outbox.constant';
import { OutboxModuleOptions } from './outbox.interface';
import { createOutboxRelayProcessor } from './outbox-relay.processor';
import OutboxRelayService from './outbox-relay.service';
import OutboxService from './outbox.service';

// The transactional outbox (docs/patterns/transactional-outbox.md). Register
// it once, in AppModule; it is global, so any feature can inject
// OutboxService. The service also lists OutboxEventEntity in its DataSource
// and validates OUTBOX_RELAY_QUEUE, OUTBOX_RELAY_LOCK_ID and the other
// OUTBOX_* variables.
@Module({})
class OutboxModule {
  static async forRoot(options: OutboxModuleOptions): Promise<DynamicModule> {
    // The queue name is needed while the module is built (by @Processor and
    // registerQueue), before ConfigService exists: wait until ConfigModule
    // has loaded and validated the env, then read it.
    await ConfigModule.envVariablesLoaded;

    const queueName = process.env['OUTBOX_RELAY_QUEUE'];

    if (!queueName) {
      throw new Error('OUTBOX_RELAY_QUEUE is not set');
    }

    return {
      module: OutboxModule,
      global: true,
      imports: [
        ...(options.imports ?? []),
        BullModule.registerQueue({ name: queueName }),
      ],
      providers: [
        { provide: OUTBOX_PRODUCER, useExisting: options.producer },
        { provide: OUTBOX_RELAY_QUEUE, useExisting: getQueueToken(queueName) },
        OutboxService,
        OutboxRelayService,
        createOutboxRelayProcessor(queueName),
      ],
      exports: [OutboxService],
    };
  }
}

export default OutboxModule;
