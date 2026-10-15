import { PROCESSOR_METADATA } from '@nestjs/bullmq/dist/bull.constants';

import { createOutboxRelayProcessor } from '../outbox-relay.processor';
import OutboxRelayService from '../outbox-relay.service';

describe('createOutboxRelayProcessor', () => {
  it('runs one relay pass per job', async () => {
    const relayService = {
      relay: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<OutboxRelayService>;
    const OutboxRelayProcessor = createOutboxRelayProcessor('EXAMPLE-QUEUE');

    await new (
      OutboxRelayProcessor as unknown as new (service: OutboxRelayService) => {
        process(): Promise<void>;
      }
    )(relayService).process();

    expect(relayService.relay).toHaveBeenCalledTimes(1);
  });

  it('listens on the queue it was built for', () => {
    const OutboxRelayProcessor = createOutboxRelayProcessor('EXAMPLE-QUEUE');

    expect(
      Reflect.getMetadata(PROCESSOR_METADATA, OutboxRelayProcessor),
    ).toEqual(expect.objectContaining({ name: 'EXAMPLE-QUEUE' }));
  });
});
