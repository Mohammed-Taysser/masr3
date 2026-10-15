import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Type } from '@nestjs/common';

import OutboxRelayService from './outbox-relay.service';

// @Processor needs the queue name when the class is declared, and each
// service has its own queue, so the class is built per queue.
// Concurrency 1: this instance never runs two relays at once. Across
// instances, the advisory lock inside relay() does the same.
function createOutboxRelayProcessor(queueName: string): Type<WorkerHost> {
  @Processor(queueName, { concurrency: 1 })
  class OutboxRelayProcessor extends WorkerHost {
    constructor(private readonly relayService: OutboxRelayService) {
      super();
    }

    async process(): Promise<void> {
      await this.relayService.relay();
    }
  }

  return OutboxRelayProcessor;
}

export { createOutboxRelayProcessor };
