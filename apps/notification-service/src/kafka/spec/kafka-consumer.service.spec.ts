import { ConfigService } from '@nestjs/config';
import { EachMessagePayload } from 'kafkajs';

import { AuthKafkaTopic, TripKafkaTopic, TripStatusEnum } from '@masr3/libs';

import AuthEventsHandler from '../../modules/events/auth-events.handler';
import TripEventsHandler from '../../modules/events/trip-events.handler';
import { NotificationTypeEnum } from '../../modules/notification/notification.enum';
import { NotificationIntent } from '../../modules/notification/notification.interface';
import NotifierService from '../../modules/notification/notifier.service';
import KafkaConsumerService from '../kafka-consumer.service';

describe('KafkaConsumerService', () => {
  let service: KafkaConsumerService;
  let authEvents: jest.Mocked<AuthEventsHandler>;
  let tripEvents: jest.Mocked<TripEventsHandler>;
  let notifier: jest.Mocked<NotifierService>;

  const intents: NotificationIntent[] = [
    {
      type: NotificationTypeEnum.WELCOME,
      userId: 1,
      data: { email: 'demo@example.com' },
      dedupeKey: 'event-1:WELCOME:1',
    },
  ];

  const event = {
    eventId: 'event-1',
    occurredAt: '2026-10-01T12:00:00.000Z',
    userId: 1,
    email: 'demo@example.com',
    firstName: 'Demo',
  };

  const tripEvent = {
    eventId: 'event-2',
    occurredAt: '2026-10-01T12:00:00.000Z',
    tripId: 7,
    customerId: 1,
    driverId: 2,
    toStatus: TripStatusEnum.ACCEPTED,
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

    authEvents = {
      handleUserRegistered: jest.fn().mockReturnValue(intents),
      handleUserLoggedIn: jest.fn().mockReturnValue(intents),
      handleUserLoggedOut: jest.fn().mockReturnValue([]),
      handleUserChangedPassword: jest.fn().mockReturnValue(intents),
      handlePasswordResetRequested: jest.fn().mockReturnValue(intents),
      handlePasswordResetCompleted: jest.fn().mockReturnValue(intents),
    } as unknown as jest.Mocked<AuthEventsHandler>;

    tripEvents = {
      handleStatusChanged: jest.fn().mockResolvedValue(intents),
    } as unknown as jest.Mocked<TripEventsHandler>;

    notifier = {
      notify: jest.fn(),
    } as unknown as jest.Mocked<NotifierService>;

    service = new KafkaConsumerService(
      configService,
      authEvents,
      tripEvents,
      notifier,
    );
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
    ] as const)(
      'routes %s to %s and notifies its intents',
      async (topic, handler) => {
        await handle(topic, event);

        expect(authEvents[handler]).toHaveBeenCalled();
        expect(notifier.notify).toHaveBeenCalledWith(
          handler === 'handleUserLoggedOut' ? [] : intents,
        );
      },
    );

    it('routes trip.status-changed to the trip handler, then the notifier', async () => {
      await handle(TripKafkaTopic.STATUS_CHANGED, tripEvent);

      expect(tripEvents.handleStatusChanged).toHaveBeenCalledWith(tripEvent);
      expect(notifier.notify).toHaveBeenCalledWith(intents);
    });
  });

  describe('subscriptions', () => {
    it('reads auth topics from the beginning and the trip topic from the latest offset', async () => {
      const consumer = {
        connect: jest.fn(),
        subscribe: jest.fn(),
        run: jest.fn(),
      };

      (service as unknown as { consumer: typeof consumer }).consumer = consumer;

      await service.onModuleInit();

      expect(consumer.subscribe).toHaveBeenCalledWith({
        topics: Object.values(AuthKafkaTopic),
        fromBeginning: true,
      });
      expect(consumer.subscribe).toHaveBeenCalledWith({
        topics: [TripKafkaTopic.STATUS_CHANGED],
        fromBeginning: false,
      });
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

      expect(authEvents.handleUserRegistered).not.toHaveBeenCalled();
      expect(notifier.notify).not.toHaveBeenCalled();
    });

    it.each([
      ['without tripId', { ...tripEvent, tripId: undefined }],
      ['without customerId', { ...tripEvent, customerId: '1' }],
      ['without toStatus', { ...tripEvent, toStatus: undefined }],
    ])('skips a trip event %s', async (_label, value) => {
      await handle(TripKafkaTopic.STATUS_CHANGED, value);

      expect(tripEvents.handleStatusChanged).not.toHaveBeenCalled();
    });

    it('skips an unknown topic', async () => {
      await expect(handle('auth.unknown', event)).resolves.toBeUndefined();
    });
  });

  describe('transient failures', () => {
    it('rethrows so the offset is not committed and Kafka redelivers', async () => {
      notifier.notify.mockRejectedValue(new Error('database unreachable'));

      await expect(handle(AuthKafkaTopic.USER_REGISTER, event)).rejects.toThrow(
        'database unreachable',
      );
    });
  });
});
