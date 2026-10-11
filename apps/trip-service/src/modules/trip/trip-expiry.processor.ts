import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import TripExpiryService from './trip-expiry.service';
import { TRIP_EXPIRY_QUEUE } from './trip.constant';
import { TripExpiryJobEnum } from './trip.enum';
import { ExpireTripJobData } from './trip.interface';

@Processor(TRIP_EXPIRY_QUEUE)
class TripExpiryProcessor extends WorkerHost {
  constructor(private readonly expiryService: TripExpiryService) {
    super();
  }

  // A thrown error fails the job, which bull-board then lists under failed.
  async process(job: Job<ExpireTripJobData>): Promise<boolean | number> {
    switch (job.name) {
      case TripExpiryJobEnum.EXPIRE_TRIP:
        return this.expiryService.expire(job.data.tripId);
      case TripExpiryJobEnum.SWEEP:
        return this.expiryService.expireDueTrips();
      default:
        throw new Error(`Unknown trip expiry job ${job.name}`);
    }
  }
}

export default TripExpiryProcessor;
