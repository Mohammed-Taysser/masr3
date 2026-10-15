import { ConfigService } from '@nestjs/config';
import { EachMessagePayload } from 'kafkajs';

import { UserRoleEnum } from '@masr3/libs/auth';
import { AuthKafkaTopic, UserChangeEnum } from '@masr3/libs/kafka';

import DriverService from '../../modules/driver/driver.service';
import KafkaConsumerService from '../kafka-consumer.service';

describe('KafkaConsumerService', () => {
  let service: KafkaConsumerService;
  let driverService: jest.Mocked<DriverService>;

  const event = {
    eventId: 'event-1',
    occurredAt: '2026-10-15T08:00:00.000Z',
    userId: 5,
    firstName: 'Omar',
    lastName: 'Hassan',
    role: UserRoleEnum.DRIVER,
    isActive: true,
    change: UserChangeEnum.UPDATED,
  };

  const payload = (topic: string, value: unknown): EachMessagePayload =>
    ({
      topic,
      partition: 0,
      message: {
        offset: '0',
        value:
          value === null
            ? null
            : Buffer.from(
                typeof value === 'string' ? value : JSON.stringify(value),
              ),
      },
    }) as unknown as EachMessagePayload;

  // handleMessage is private, but it is the whole contract of this class;
  // reaching it through the public surface would need a broker.
  const handle = (topic: string, value: unknown) =>
    (
      service as unknown as {
        handleMessage(p: EachMessagePayload): Promise<void>;
      }
    ).handleMessage(payload(topic, value));

  beforeEach(() => {
    const configService = {
      getOrThrow: jest.fn().mockReturnValue('value'),
    } as unknown as ConfigService;

    driverService = {
      applyUserChanged: jest.fn(),
    } as unknown as jest.Mocked<DriverService>;

    service = new KafkaConsumerService(configService, driverService);
  });

  it('applies a valid auth.user-changed event to the drivers copy', async () => {
    await handle(AuthKafkaTopic.USER_CHANGED, event);

    expect(driverService.applyUserChanged).toHaveBeenCalledWith(
      expect.objectContaining(event),
    );
  });

  it('passes a role or change it does not know yet through', async () => {
    await handle(AuthKafkaTopic.USER_CHANGED, {
      ...event,
      role: 'COURIER',
      change: 'MERGED',
    });

    expect(driverService.applyUserChanged).toHaveBeenCalled();
  });

  it.each([
    ['an empty message', null],
    ['invalid JSON', '{not json'],
    ['a JSON array', [event]],
    ['a missing userId', { ...event, userId: undefined }],
    ['a non-boolean isActive', { ...event, isActive: 'yes' }],
    ['a missing eventId', { ...event, eventId: undefined }],
  ])('skips %s without calling the handler', async (_case, value) => {
    await expect(
      handle(AuthKafkaTopic.USER_CHANGED, value),
    ).resolves.toBeUndefined();

    expect(driverService.applyUserChanged).not.toHaveBeenCalled();
  });

  it('skips a topic it has no handler for', async () => {
    await handle('auth.user-register', event);

    expect(driverService.applyUserChanged).not.toHaveBeenCalled();
  });

  it('rethrows a handler failure so the offset is not committed', async () => {
    driverService.applyUserChanged.mockRejectedValue(
      new Error('connection lost'),
    );

    await expect(handle(AuthKafkaTopic.USER_CHANGED, event)).rejects.toThrow(
      'connection lost',
    );
  });

  it('subscribes to auth.user-changed from the beginning', async () => {
    const consumer = {
      connect: jest.fn(),
      subscribe: jest.fn(),
      run: jest.fn(),
    };

    (service as unknown as { consumer: typeof consumer }).consumer = consumer;

    await service.onModuleInit();

    expect(consumer.subscribe).toHaveBeenCalledWith({
      topics: [AuthKafkaTopic.USER_CHANGED],
      fromBeginning: true,
    });
  });
});
