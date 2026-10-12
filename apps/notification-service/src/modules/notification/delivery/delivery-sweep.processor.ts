import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { NOTIFICATION_SWEEP_QUEUE } from '../notification.constant';
import { NotificationJobEnum } from '../notification.enum';
import DeliveryService from './delivery.service';

@Processor(NOTIFICATION_SWEEP_QUEUE)
class DeliverySweepProcessor extends WorkerHost {
  private readonly logger = new Logger(DeliverySweepProcessor.name);

  constructor(private readonly deliveryService: DeliveryService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case NotificationJobEnum.SWEEP: {
        const requeued = await this.deliveryService.requeueStale();

        if (requeued > 0) {
          this.logger.warn(
            `Re-queued ${requeued} delivery job(s) that were never added`,
          );
        }

        return;
      }
      default:
        throw new Error(`Unknown sweep job ${job.name}`);
    }
  }
}

export default DeliverySweepProcessor;
