import { Job } from 'bullmq';

import TripExpiryProcessor from '../trip-expiry.processor';
import TripExpiryService from '../trip-expiry.service';
import { TripExpiryJobEnum } from '../trip.enum';
import { ExpireTripJobData } from '../trip.interface';

describe('TripExpiryProcessor', () => {
  let processor: TripExpiryProcessor;
  let expiryService: jest.Mocked<TripExpiryService>;

  const job = (name: string, data = { tripId: 7 }) =>
    ({ name, data }) as Job<ExpireTripJobData>;

  beforeEach(() => {
    expiryService = {
      expire: jest.fn().mockResolvedValue(true),
      expireDueTrips: jest.fn().mockResolvedValue(3),
    } as unknown as jest.Mocked<TripExpiryService>;

    processor = new TripExpiryProcessor(expiryService);
  });

  it('expires the trip named by an EXPIRE_TRIP job', async () => {
    await expect(
      processor.process(job(TripExpiryJobEnum.EXPIRE_TRIP)),
    ).resolves.toBe(true);

    expect(expiryService.expire).toHaveBeenCalledWith(7);
  });

  it('runs the sweep for a SWEEP job', async () => {
    await expect(processor.process(job(TripExpiryJobEnum.SWEEP))).resolves.toBe(
      3,
    );

    expect(expiryService.expireDueTrips).toHaveBeenCalled();
  });

  it('fails an unknown job', async () => {
    await expect(processor.process(job('OTHER'))).rejects.toThrow(
      'Unknown trip expiry job OTHER',
    );
  });
});
