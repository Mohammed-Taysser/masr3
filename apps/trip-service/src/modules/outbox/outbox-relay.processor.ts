import { Processor, WorkerHost } from '@nestjs/bullmq';

import OutboxRelayService from './outbox-relay.service';
import { OUTBOX_RELAY_QUEUE } from './outbox.constant';

// Concurrency 1: this instance never runs two relays at once. Across
// instances, the advisory lock inside relay() does the same.
@Processor(OUTBOX_RELAY_QUEUE, { concurrency: 1 })
class OutboxRelayProcessor extends WorkerHost {
  constructor(private readonly relayService: OutboxRelayService) {
    super();
  }

  async process(): Promise<void> {
    await this.relayService.relay();
  }
}

export default OutboxRelayProcessor;
