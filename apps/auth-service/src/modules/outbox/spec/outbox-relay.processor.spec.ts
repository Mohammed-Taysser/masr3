import OutboxRelayProcessor from '../outbox-relay.processor';
import OutboxRelayService from '../outbox-relay.service';

describe('OutboxRelayProcessor', () => {
  it('runs one relay pass per job', async () => {
    const relayService = {
      relay: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<OutboxRelayService>;

    await new OutboxRelayProcessor(relayService).process();

    expect(relayService.relay).toHaveBeenCalledTimes(1);
  });
});
