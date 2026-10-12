import { Job, Queue } from 'bullmq';

import DeliveryQueueService from '../delivery/delivery-queue.service';
import NotificationDeliveryEntity from '../entities/notification-delivery.entity';
import {
  DELIVERY_ATTEMPTS,
  NOTIFICATION_SWEEP_SCHEDULER_ID,
} from '../notification.constant';
import {
  NotificationChannelEnum,
  NotificationJobEnum,
} from '../notification.enum';

describe('DeliveryQueueService', () => {
  let service: DeliveryQueueService;
  let emailQueue: jest.Mocked<Queue>;
  let sweepQueue: jest.Mocked<Queue>;

  const queue = () =>
    ({
      add: jest.fn(),
      getJob: jest.fn().mockResolvedValue(undefined),
      upsertJobScheduler: jest.fn(),
    }) as unknown as jest.Mocked<Queue>;
  const delivery = {
    id: 31,
    channel: NotificationChannelEnum.EMAIL,
  } as NotificationDeliveryEntity;

  beforeEach(() => {
    emailQueue = queue();
    sweepQueue = queue();
    service = new DeliveryQueueService(emailQueue, queue(), sweepQueue);
  });

  it('schedules the sweep on boot', async () => {
    await service.onApplicationBootstrap();

    expect(sweepQueue.upsertJobScheduler).toHaveBeenCalledWith(
      NOTIFICATION_SWEEP_SCHEDULER_ID,
      expect.objectContaining({ every: expect.any(Number) }),
      { name: NotificationJobEnum.SWEEP },
    );
  });

  it('queues a delivery on its channel with a stable job id and retries', async () => {
    await service.enqueue(delivery);

    expect(emailQueue.add).toHaveBeenCalledWith(
      NotificationJobEnum.DELIVER,
      { deliveryId: 31, secrets: undefined },
      expect.objectContaining({
        jobId: 'delivery-31',
        attempts: DELIVERY_ATTEMPTS,
      }),
    );
    expect(emailQueue.add.mock.calls[0][2]).not.toHaveProperty(
      'removeOnComplete',
    );
  });

  it('removes a job carrying secrets as soon as it completes', async () => {
    await service.enqueue(delivery, { resetUrl: 'x' });

    expect(emailQueue.add.mock.calls[0][2]).toEqual(
      expect.objectContaining({ removeOnComplete: true }),
    );
  });

  it('refuses a channel that has no queue', async () => {
    await expect(
      service.enqueue({ ...delivery, channel: NotificationChannelEnum.SMS }),
    ).rejects.toThrow('No queue for the SMS channel');
  });

  describe('retry', () => {
    it('retries the failed job, which still holds its secrets', async () => {
      const job = {
        isFailed: jest.fn().mockResolvedValue(true),
        retry: jest.fn(),
      };
      emailQueue.getJob.mockResolvedValue(job as unknown as Job);

      await expect(service.retry(delivery, true)).resolves.toBe(true);
      expect(job.retry).toHaveBeenCalled();
      expect(emailQueue.add).not.toHaveBeenCalled();
    });

    it('queues a fresh job when BullMQ no longer has one', async () => {
      await expect(service.retry(delivery, false)).resolves.toBe(true);
      expect(emailQueue.add).toHaveBeenCalled();
    });

    it('cannot rebuild a job that needs secrets', async () => {
      await expect(service.retry(delivery, true)).resolves.toBe(false);
      expect(emailQueue.add).not.toHaveBeenCalled();
    });
  });
});
