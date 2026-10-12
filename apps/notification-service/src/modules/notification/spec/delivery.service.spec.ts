import { Repository } from 'typeorm';

import ChannelProviderRegistry from '../delivery/channel-provider.registry';
import DeliveryQueueService from '../delivery/delivery-queue.service';
import DeliveryService from '../delivery/delivery.service';
import NotificationDeliveryEntity from '../entities/notification-delivery.entity';
import NotificationEntity from '../entities/notification.entity';
import {
  DeliveryStatusEnum,
  NotificationChannelEnum,
  NotificationTypeEnum,
} from '../notification.enum';
import RendererService from '../rendering/renderer.service';

describe('DeliveryService', () => {
  let service: DeliveryService;
  let repository: jest.Mocked<Repository<NotificationDeliveryEntity>>;
  let renderer: jest.Mocked<RendererService>;
  let send: jest.Mock;
  let deliveryQueue: jest.Mocked<DeliveryQueueService>;

  const notification = {
    id: 12,
    type: NotificationTypeEnum.TRIP_RECEIPT,
    locale: 'en',
    recipientName: 'Ahmed',
    data: { tripId: 7 },
    attachments: null,
  } as unknown as NotificationEntity;

  const delivery = (changes: Partial<NotificationDeliveryEntity> = {}) =>
    ({
      id: 31,
      notificationId: 12,
      notification,
      channel: NotificationChannelEnum.EMAIL,
      address: 'customer@masr3.local',
      status: DeliveryStatusEnum.QUEUED,
      attempts: 0,
      ...changes,
    }) as NotificationDeliveryEntity;

  beforeEach(() => {
    repository = {
      findOne: jest.fn().mockResolvedValue(delivery()),
      find: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<NotificationDeliveryEntity>>;
    renderer = {
      render: jest.fn().mockReturnValue({
        subject: 'Your trip receipt',
        html: '<p/>',
        text: 'text',
        attachments: [],
      }),
    } as unknown as jest.Mocked<RendererService>;
    send = jest.fn().mockResolvedValue({ providerMessageId: '<id@mailhog>' });
    deliveryQueue = {
      hasJob: jest.fn().mockResolvedValue(false),
      enqueue: jest.fn(),
    } as unknown as jest.Mocked<DeliveryQueueService>;

    service = new DeliveryService(
      repository,
      renderer,
      {
        get: () => ({ configured: true, send }),
      } as unknown as ChannelProviderRegistry,
      deliveryQueue,
    );
  });

  describe('deliver', () => {
    it('renders in the recipient’s locale, sends, and records SENT', async () => {
      await service.deliver(31, { resetUrl: 'x' }, false);

      expect(renderer.render).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationTypeEnum.TRIP_RECEIPT,
          channel: NotificationChannelEnum.EMAIL,
          locale: 'en',
          firstName: 'Ahmed',
          secrets: { resetUrl: 'x' },
        }),
      );
      expect(repository.update).toHaveBeenCalledWith(
        31,
        expect.objectContaining({
          status: DeliveryStatusEnum.SENT,
          attempts: 1,
          providerMessageId: '<id@mailhog>',
          subject: 'Your trip receipt',
          lastError: null,
        }),
      );
    });

    it('keeps the delivery QUEUED and rethrows on a failure that will be retried', async () => {
      send.mockRejectedValue(new Error('SMTP down'));

      await expect(service.deliver(31, undefined, false)).rejects.toThrow(
        'SMTP down',
      );
      expect(repository.update).toHaveBeenCalledWith(31, {
        status: DeliveryStatusEnum.QUEUED,
        attempts: 1,
        lastError: 'SMTP down',
      });
    });

    it('marks the delivery FAILED after the last attempt', async () => {
      send.mockRejectedValue(new Error('SMTP down'));

      await expect(service.deliver(31, undefined, true)).rejects.toThrow();
      expect(repository.update).toHaveBeenCalledWith(
        31,
        expect.objectContaining({ status: DeliveryStatusEnum.FAILED }),
      );
    });

    it.each([DeliveryStatusEnum.SENT, DeliveryStatusEnum.SKIPPED])(
      'does nothing for a delivery already %s, so a duplicate job is harmless',
      async (status) => {
        repository.findOne.mockResolvedValue(delivery({ status }));

        await service.deliver(31, undefined, false);

        expect(send).not.toHaveBeenCalled();
        expect(repository.update).not.toHaveBeenCalled();
      },
    );
  });

  describe('preview', () => {
    it('renders and hands the message to the provider without changing the row', async () => {
      await service.preview(
        delivery({ channel: NotificationChannelEnum.SMS }),
        notification,
        undefined,
      );

      expect(send).toHaveBeenCalled();
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('never throws: a preview is only a log line', async () => {
      renderer.render.mockImplementation(() => {
        throw new Error('No SHORT_TEXT template');
      });

      await expect(
        service.preview(delivery(), notification, undefined),
      ).resolves.toBeUndefined();
    });
  });

  describe('requeueStale', () => {
    it('re-queues a stale QUEUED delivery whose job is missing', async () => {
      repository.find.mockResolvedValue([delivery()]);

      await expect(service.requeueStale()).resolves.toBe(1);
      expect(deliveryQueue.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ id: 31 }),
      );
    });

    it('leaves a delivery whose job still exists (waiting or retrying)', async () => {
      repository.find.mockResolvedValue([delivery()]);
      deliveryQueue.hasJob.mockResolvedValue(true);

      await expect(service.requeueStale()).resolves.toBe(0);
      expect(deliveryQueue.enqueue).not.toHaveBeenCalled();
    });

    it('fails one that needs a secret, since the secret went with the lost job', async () => {
      repository.find.mockResolvedValue([
        delivery({
          notification: {
            ...notification,
            type: NotificationTypeEnum.PASSWORD_RESET,
          } as NotificationEntity,
        }),
      ]);

      await service.requeueStale();

      expect(deliveryQueue.enqueue).not.toHaveBeenCalled();
      expect(repository.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: DeliveryStatusEnum.FAILED }),
      );
    });
  });
});
