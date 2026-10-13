import { DataSource, EntityManager } from 'typeorm';

import PreferencesService from '../../preferences/preferences.service';
import ChannelProviderRegistry from '../delivery/channel-provider.registry';
import DeliveryQueueService from '../delivery/delivery-queue.service';
import DeliveryService from '../delivery/delivery.service';
import NotificationDeliveryEntity from '../entities/notification-delivery.entity';
import {
  DeliverySkipReasonEnum,
  DeliveryStatusEnum,
  NotificationChannelEnum,
  NotificationTypeEnum,
} from '../notification.enum';
import { NotificationIntent, Recipient } from '../notification.interface';
import NotifierService from '../notifier.service';
import RecipientService from '../recipient.service';

const { EMAIL, SMS, PUSH, IN_APP } = NotificationChannelEnum;

describe('NotifierService', () => {
  let notifier: NotifierService;
  let recipientService: jest.Mocked<RecipientService>;
  let preferencesService: jest.Mocked<PreferencesService>;
  let deliveryQueue: jest.Mocked<DeliveryQueueService>;
  let deliveryService: jest.Mocked<DeliveryService>;
  let inserted: Record<string, unknown> | null;
  let insertedRow: { id: number } | null;
  let savedDeliveries: Partial<NotificationDeliveryEntity>[];

  const recipient: Recipient = {
    userId: 1,
    firstName: 'Ahmed',
    email: 'customer@masr3.local',
    phone: null,
    deviceToken: null,
    locale: 'en',
  };

  const tripIntent: NotificationIntent<NotificationTypeEnum.TRIP_ASSIGNED> = {
    type: NotificationTypeEnum.TRIP_ASSIGNED,
    userId: 1,
    dedupeKey: 'event-1:TRIP_ASSIGNED:1',
    data: {
      tripId: 7,
      pickupAddress: 'Tahrir Square',
      dropoffAddress: 'Zamalek',
      fare: 95,
      currency: 'EGP',
      customerFirstName: 'Ahmed',
    },
  };

  const deliveries = () =>
    Object.fromEntries(
      savedDeliveries.map((delivery) => [
        delivery.channel,
        {
          status: delivery.status,
          skipReason: delivery.skipReason,
          address: delivery.address,
        },
      ]),
    );

  beforeEach(() => {
    inserted = null;
    insertedRow = { id: 12 };
    savedDeliveries = [];

    const insertBuilder = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn((values: Record<string, unknown>) => {
        inserted = values;

        return insertBuilder;
      }),
      orIgnore: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      execute: jest.fn(async () => ({
        raw: insertedRow ? [{ ...inserted, ...insertedRow }] : [],
      })),
    };
    const manager = {
      createQueryBuilder: jest.fn(() => insertBuilder),
      create: jest.fn((_entity, values) => values),
      save: jest.fn(
        async (_entity, rows: Partial<NotificationDeliveryEntity>[]) => {
          savedDeliveries = rows.map((row, index) => ({
            ...row,
            id: 100 + index,
          }));

          return savedDeliveries;
        },
      ),
    } as unknown as EntityManager;
    const dataSource = {
      transaction: jest.fn((work: (manager: EntityManager) => unknown) =>
        work(manager),
      ),
    } as unknown as DataSource;

    recipientService = {
      find: jest.fn().mockResolvedValue(recipient),
    } as unknown as jest.Mocked<RecipientService>;
    preferencesService = {
      disabledChannels: jest.fn().mockResolvedValue(new Set()),
    } as unknown as jest.Mocked<PreferencesService>;
    deliveryQueue = {
      enqueue: jest.fn(),
    } as unknown as jest.Mocked<DeliveryQueueService>;
    deliveryService = {
      preview: jest.fn(),
    } as unknown as jest.Mocked<DeliveryService>;
    const configured = new Set([EMAIL, IN_APP]);
    const providers = {
      get: (channel: NotificationChannelEnum) => ({
        configured: configured.has(channel),
      }),
    } as unknown as ChannelProviderRegistry;

    notifier = new NotifierService(
      dataSource,
      recipientService,
      preferencesService,
      providers,
      deliveryQueue,
      deliveryService,
    );
  });

  it('records one delivery per default channel and queues those that can be sent', async () => {
    await notifier.notify([tripIntent]);

    expect(inserted).toEqual(
      expect.objectContaining({
        type: NotificationTypeEnum.TRIP_ASSIGNED,
        userId: 1,
        dedupeKey: 'event-1:TRIP_ASSIGNED:1',
        locale: 'en',
        recipientName: 'Ahmed',
      }),
    );
    expect(deliveries()).toEqual({
      [EMAIL]: {
        status: DeliveryStatusEnum.QUEUED,
        skipReason: null,
        address: 'customer@masr3.local',
      },
      [PUSH]: {
        status: DeliveryStatusEnum.SKIPPED,
        skipReason: DeliverySkipReasonEnum.PROVIDER_NOT_CONFIGURED,
        address: null,
      },
      [SMS]: {
        status: DeliveryStatusEnum.SKIPPED,
        skipReason: DeliverySkipReasonEnum.PROVIDER_NOT_CONFIGURED,
        address: null,
      },
      [IN_APP]: {
        status: DeliveryStatusEnum.QUEUED,
        skipReason: null,
        address: '1',
      },
    });
    expect(deliveryQueue.enqueue).toHaveBeenCalledTimes(2);
    expect(deliveryService.preview).toHaveBeenCalledTimes(2);
  });

  it('sends only on the channels an intent asks for', async () => {
    await notifier.notify([{ ...tripIntent, channels: [IN_APP] }]);

    expect(Object.keys(deliveries())).toEqual([IN_APP]);
  });

  it('records every channel as skipped when auth-service has no such user', async () => {
    recipientService.find.mockResolvedValue(null);

    await notifier.notify([tripIntent]);

    expect(inserted).toEqual(expect.objectContaining({ recipientName: null }));
    expect(
      Object.values(deliveries()).every(
        (delivery) =>
          delivery.skipReason === DeliverySkipReasonEnum.RECIPIENT_NOT_FOUND,
      ),
    ).toBe(true);
    expect(deliveryQueue.enqueue).not.toHaveBeenCalled();
  });

  it('marks a channel without an address as missing contact', async () => {
    recipientService.find.mockResolvedValue({ ...recipient, email: null });

    await notifier.notify([tripIntent]);

    expect(deliveries()[EMAIL].skipReason).toBe(
      DeliverySkipReasonEnum.MISSING_CONTACT,
    );
  });

  it("honours the user's opt-outs for an optional notification", async () => {
    preferencesService.disabledChannels.mockResolvedValue(new Set([EMAIL]));

    await notifier.notify([tripIntent]);

    expect(deliveries()[EMAIL].skipReason).toBe(
      DeliverySkipReasonEnum.OPTED_OUT,
    );
  });

  it('ignores opt-outs for a mandatory notification', async () => {
    await notifier.notify([
      {
        type: NotificationTypeEnum.PASSWORD_CHANGED,
        userId: 1,
        dedupeKey: 'event-2:PASSWORD_CHANGED:1',
        data: { occurredAt: '2026-10-12T08:00:00.000Z' },
      },
    ]);

    expect(preferencesService.disabledChannels).not.toHaveBeenCalled();
    expect(deliveries()[EMAIL].status).toBe(DeliveryStatusEnum.QUEUED);
  });

  it('stops when the dedupe key was already handled', async () => {
    insertedRow = null;

    await notifier.notify([tripIntent]);

    expect(savedDeliveries).toEqual([]);
    expect(deliveryQueue.enqueue).not.toHaveBeenCalled();
  });

  it('keeps secrets out of the row and passes them to the queue only', async () => {
    await notifier.notify([
      {
        type: NotificationTypeEnum.PASSWORD_RESET,
        userId: 1,
        dedupeKey: 'event-3:PASSWORD_RESET:1',
        data: { expiresInMinutes: 10 },
        secrets: { resetUrl: 'http://x/reset?token=raw' },
      },
    ]);

    expect(JSON.stringify(inserted)).not.toContain('token=raw');
    expect(deliveryQueue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ channel: EMAIL }),
      { resetUrl: 'http://x/reset?token=raw' },
    );
  });

  it('previews an unconfigured channel with secrets masked', async () => {
    await notifier.notify([
      { ...tripIntent, channels: [SMS], secrets: { code: '1234' } },
    ]);

    expect(deliveryService.preview).toHaveBeenCalledWith(
      expect.objectContaining({ channel: SMS }),
      expect.objectContaining({ id: 12 }),
      { code: '***' },
    );
  });

  it('does not fail the event when the queue is down; the sweep adds the job later', async () => {
    deliveryQueue.enqueue.mockRejectedValue(new Error('Redis down'));

    await expect(notifier.notify([tripIntent])).resolves.toBeUndefined();
  });

  it('rethrows when auth-service is down, so Kafka redelivers', async () => {
    recipientService.find.mockRejectedValue(
      new Error('auth-service unavailable'),
    );

    await expect(notifier.notify([tripIntent])).rejects.toThrow(
      'auth-service unavailable',
    );
  });
});
