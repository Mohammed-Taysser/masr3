import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';

import DeliveryLogService from '../delivery/delivery-log.service';
import DeliveryQueueService from '../delivery/delivery-queue.service';
import NotificationDeliveryEntity from '../entities/notification-delivery.entity';
import {
  DeliveryStatusEnum,
  NotificationChannelEnum,
  NotificationTypeEnum,
} from '../notification.enum';

describe('DeliveryLogService', () => {
  let service: DeliveryLogService;
  let repository: jest.Mocked<Repository<NotificationDeliveryEntity>>;
  let deliveryQueue: jest.Mocked<DeliveryQueueService>;

  const failed = (type = NotificationTypeEnum.TRIP_RECEIPT) =>
    ({
      id: 31,
      status: DeliveryStatusEnum.FAILED,
      lastError: 'SMTP down',
      notification: { type },
    }) as NotificationDeliveryEntity;

  beforeEach(() => {
    repository = {
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      findOne: jest.fn().mockResolvedValue(failed()),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<NotificationDeliveryEntity>>;
    deliveryQueue = {
      retry: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<DeliveryQueueService>;
    service = new DeliveryLogService(repository, deliveryQueue);
  });

  it('filters only by what was given', async () => {
    await service.list({ page: 2, limit: 10 });
    expect(repository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: {}, skip: 10, take: 10 }),
    );

    await service.list({
      status: DeliveryStatusEnum.FAILED,
      channel: NotificationChannelEnum.EMAIL,
      userId: 2,
      page: 1,
      limit: 20,
    });
    expect(repository.findAndCount).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          status: DeliveryStatusEnum.FAILED,
          channel: NotificationChannelEnum.EMAIL,
          notification: { userId: 2 },
        },
      }),
    );
  });

  it('re-queues a FAILED delivery', async () => {
    await expect(service.retry(31)).resolves.toEqual(
      expect.objectContaining({
        status: DeliveryStatusEnum.QUEUED,
        lastError: null,
      }),
    );
    expect(repository.update).toHaveBeenCalledWith(31, {
      status: DeliveryStatusEnum.QUEUED,
      lastError: null,
    });
    expect(deliveryQueue.retry).toHaveBeenCalledWith(
      expect.objectContaining({ id: 31 }),
      false,
    );
  });

  it('answers 404 for an unknown delivery and 409 for one not FAILED', async () => {
    repository.findOne.mockResolvedValueOnce(null);
    await expect(service.retry(31)).rejects.toBeInstanceOf(NotFoundException);

    repository.findOne.mockResolvedValueOnce({
      ...failed(),
      status: DeliveryStatusEnum.SENT,
    } as NotificationDeliveryEntity);
    await expect(service.retry(31)).rejects.toBeInstanceOf(ConflictException);
  });

  it('puts it back to FAILED with 409 when its secret is gone', async () => {
    repository.findOne.mockResolvedValue(
      failed(NotificationTypeEnum.PASSWORD_RESET),
    );
    deliveryQueue.retry.mockResolvedValue(false);

    await expect(service.retry(31)).rejects.toBeInstanceOf(ConflictException);
    expect(deliveryQueue.retry).toHaveBeenCalledWith(expect.anything(), true);
    expect(repository.update).toHaveBeenLastCalledWith(31, {
      status: DeliveryStatusEnum.FAILED,
      lastError: 'SMTP down',
    });
  });
});
