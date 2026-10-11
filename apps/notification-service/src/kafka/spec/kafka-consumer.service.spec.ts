import { ConfigService } from '@nestjs/config';
import { EachMessagePayload } from 'kafkajs';

import { AuthKafkaTopic } from '@masr3/libs';

import NotificationService from '../../modules/notification/notification.service';
import KafkaConsumerService from '../kafka-consumer.service';

describe('KafkaConsumerService', () => {
  let service: KafkaConsumerService;
  let notificationService: jest.Mocked<NotificationService>;

  const event = {
    eventId: 'event-1',
    occurredAt: '2026-10-01T12:00:00.000Z',
    userId: 1,
    email: 'demo@example.com',
    firstName: 'Demo',
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

    notificationService = {
      handleUserRegistered: jest.fn(),
      handleUserLoggedIn: jest.fn(),
      handleUserLoggedOut: jest.fn(),
      handleUserChangedPassword: jest.fn(),
      handlePasswordResetRequested: jest.fn(),
      handlePasswordResetCompleted: jest.fn(),
    } as unknown as jest.Mocked<NotificationService>;

    service = new KafkaConsumerService(configService, notificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('dispatch', () => {
    it.each([
      [AuthKafkaTopic.USER_REGISTER, 'handleUserRegistered'],
      [AuthKafkaTopic.USER_LOGGED_IN, 'handleUserLoggedIn'],
      [AuthKafkaTopic.USER_LOGGED_OUT, 'handleUserLoggedOut'],
      [AuthKafkaTopic.USER_CHANGE_PASSWORD, 'handleUserChangedPassword'],
      [AuthKafkaTopic.PASSWORD_RESET_REQUESTED, 'handlePasswordResetRequested'],
      [AuthKafkaTopic.PASSWORD_RESET_COMPLETED, 'handlePasswordResetCompleted'],
    ] as const)('routes %s to %s', async (topic, handler) => {
      await handle(topic, event);

      expect(notificationService[handler]).toHaveBeenCalledWith(event);
    });
  });

  describe('poison messages are skipped, not retried', () => {
    it.each([
      ['an empty value', null],
      ['invalid JSON', '{not json'],
      ['a payload without eventId', { email: 'demo@example.com' }],
      ['a payload without email', { eventId: 'event-1' }],
    ])('skips %s', async (_label, value) => {
      await expect(
        handle(AuthKafkaTopic.USER_REGISTER, value),
      ).resolves.toBeUndefined();

      expect(notificationService.handleUserRegistered).not.toHaveBeenCalled();
    });

    it('skips an unknown topic', async () => {
      await expect(handle('auth.unknown', event)).resolves.toBeUndefined();
    });
  });

  describe('transient failures', () => {
    it('rethrows so the offset is not committed and Kafka redelivers', async () => {
      notificationService.handleUserRegistered.mockRejectedValue(
        new Error('database unreachable'),
      );

      await expect(handle(AuthKafkaTopic.USER_REGISTER, event)).rejects.toThrow(
        'database unreachable',
      );
    });
  });
});
