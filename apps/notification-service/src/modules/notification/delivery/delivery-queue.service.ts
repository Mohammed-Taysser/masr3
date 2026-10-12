import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';

import NotificationDeliveryEntity from '../entities/notification-delivery.entity';
import {
  DELIVERY_ATTEMPTS,
  DELIVERY_BACKOFF_MS,
  DELIVERY_SWEEP_INTERVAL_MS,
  NOTIFICATION_EMAIL_QUEUE,
  NOTIFICATION_IN_APP_QUEUE,
  NOTIFICATION_SWEEP_QUEUE,
  NOTIFICATION_SWEEP_SCHEDULER_ID,
} from '../notification.constant';
import {
  NotificationChannelEnum,
  NotificationJobEnum,
} from '../notification.enum';
import {
  DeliveryJobData,
  NotificationSecrets,
} from '../notification.interface';

@Injectable()
class DeliveryQueueService implements OnApplicationBootstrap {
  private readonly queues: Partial<Record<NotificationChannelEnum, Queue>>;

  constructor(
    @InjectQueue(NOTIFICATION_EMAIL_QUEUE) emailQueue: Queue,
    @InjectQueue(NOTIFICATION_IN_APP_QUEUE) inAppQueue: Queue,
    @InjectQueue(NOTIFICATION_SWEEP_QUEUE) private readonly sweepQueue: Queue,
  ) {
    this.queues = {
      [NotificationChannelEnum.EMAIL]: emailQueue,
      [NotificationChannelEnum.IN_APP]: inAppQueue,
    };
  }

  async onApplicationBootstrap() {
    await this.sweepQueue.upsertJobScheduler(
      NOTIFICATION_SWEEP_SCHEDULER_ID,
      { every: DELIVERY_SWEEP_INTERVAL_MS },
      { name: NotificationJobEnum.SWEEP },
    );
  }

  // A job carrying secrets is removed as soon as it completes, so the secret
  // doesn't linger in Redis or bull-board.
  async enqueue(
    delivery: NotificationDeliveryEntity,
    secrets?: NotificationSecrets,
  ): Promise<void> {
    const data: DeliveryJobData = { deliveryId: delivery.id, secrets };

    await this.queueFor(delivery.channel).add(
      NotificationJobEnum.DELIVER,
      data,
      {
        jobId: DeliveryQueueService.jobId(delivery),
        attempts: DELIVERY_ATTEMPTS,
        backoff: { type: 'exponential', delay: DELIVERY_BACKOFF_MS },
        ...(secrets && { removeOnComplete: true }),
      },
    );
  }

  async hasJob(delivery: NotificationDeliveryEntity): Promise<boolean> {
    const job = await this.queueFor(delivery.channel).getJob(
      DeliveryQueueService.jobId(delivery),
    );

    return job !== undefined;
  }

  // Retries the failed job when BullMQ still has it (its secrets included);
  // otherwise queues a fresh one. False when neither is possible.
  async retry(
    delivery: NotificationDeliveryEntity,
    needsSecrets: boolean,
  ): Promise<boolean> {
    const job = await this.queueFor(delivery.channel).getJob(
      DeliveryQueueService.jobId(delivery),
    );

    if (job && (await job.isFailed())) {
      await job.retry();

      return true;
    }

    if (job) {
      await job.remove();
    }

    if (needsSecrets) {
      return false;
    }

    await this.enqueue(delivery);

    return true;
  }

  private queueFor(channel: NotificationChannelEnum): Queue {
    const queue = this.queues[channel];

    if (!queue) {
      throw new Error(`No queue for the ${channel} channel`);
    }

    return queue;
  }

  private static jobId(delivery: NotificationDeliveryEntity): string {
    return `delivery-${delivery.id}`;
  }
}

export default DeliveryQueueService;
