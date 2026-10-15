import { getQueueToken } from '@nestjs/bullmq';
import { Provider } from '@nestjs/common';

import { OUTBOX_RELAY_QUEUE } from '../outbox.constant';
import OutboxModule from '../outbox.module';

describe('OutboxModule.forRoot', () => {
  it('registers a global module on the given queue', () => {
    const dynamicModule = OutboxModule.forRoot({
      queue: 'example-outbox-relay',
    });

    expect(dynamicModule.global).toBe(true);
    expect(dynamicModule.providers).toContainEqual<Provider>({
      provide: OUTBOX_RELAY_QUEUE,
      useExisting: getQueueToken('example-outbox-relay'),
    });
  });

  it.each(['EXAMPLE-OUTBOX-RELAY', 'outbox', 'outbox_relay', '-outbox-relay'])(
    'rejects the queue name %p',
    (queue) => {
      expect(() => OutboxModule.forRoot({ queue })).toThrow('kebab-case');
    },
  );
});
