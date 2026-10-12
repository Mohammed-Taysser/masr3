import { WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';

import { NotificationJobEnum } from '../notification.enum';
import { DeliveryJobData } from '../notification.interface';
import DeliveryService from './delivery.service';

// Shared by every channel's processor; each subclass only binds a queue.
@Injectable()
abstract class ChannelDeliveryProcessor extends WorkerHost {
  constructor(private readonly deliveryService: DeliveryService) {
    super();
  }

  async process(job: Job<DeliveryJobData>): Promise<void> {
    switch (job.name) {
      case NotificationJobEnum.DELIVER: {
        const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);

        return this.deliveryService.deliver(
          job.data.deliveryId,
          job.data.secrets,
          isLastAttempt,
        );
      }
      default:
        throw new Error(`Unknown delivery job ${job.name}`);
    }
  }
}

export default ChannelDeliveryProcessor;
