import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { FindOperator, Repository } from 'typeorm';

import { dayjs, TripActorEnum, TripStatusEnum } from '@masr3/libs';

import TripEntity from '../entities/trip.entity';
import TripExpiryService from '../trip-expiry.service';
import { TRIP_EXPIRY_SWEEP_SCHEDULER_ID } from '../trip.constant';
import { TripExpiryJobEnum } from '../trip.enum';
import TripService from '../trip.service';

const BATCH_SIZE = 50;

const config: Record<string, number> = {
  TRIP_EXPIRY_SWEEP_INTERVAL_MS: 60000,
  TRIP_EXPIRY_BATCH_SIZE: BATCH_SIZE,
};

describe('TripExpiryService', () => {
  let expiry: TripExpiryService;
  let tripService: jest.Mocked<TripService>;
  let tripRepository: jest.Mocked<Repository<TripEntity>>;
  let expiryQueue: jest.Mocked<Queue>;

  const dueTrips = (...ids: number[]) =>
    tripRepository.find.mockResolvedValue(
      ids.map((id) => ({ id }) as TripEntity),
    );

  beforeEach(() => {
    tripService = {
      transition: jest.fn(),
    } as unknown as jest.Mocked<TripService>;

    tripRepository = {
      find: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<Repository<TripEntity>>;

    expiryQueue = {
      upsertJobScheduler: jest.fn(),
    } as unknown as jest.Mocked<Queue>;

    const configService = {
      getOrThrow: jest.fn((key: string) => config[key]),
    } as unknown as ConfigService;

    expiry = new TripExpiryService(
      tripService,
      tripRepository,
      expiryQueue,
      configService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('schedules a SWEEP job every TRIP_EXPIRY_SWEEP_INTERVAL_MS on boot', async () => {
    await expiry.onApplicationBootstrap();

    expect(expiryQueue.upsertJobScheduler).toHaveBeenCalledWith(
      TRIP_EXPIRY_SWEEP_SCHEDULER_ID,
      { every: config.TRIP_EXPIRY_SWEEP_INTERVAL_MS },
      { name: TripExpiryJobEnum.SWEEP },
    );
  });

  describe('expire', () => {
    it('expires the trip as SYSTEM through TripService', async () => {
      await expect(expiry.expire(3)).resolves.toBe(true);

      expect(tripService.transition).toHaveBeenCalledWith({
        tripId: 3,
        to: TripStatusEnum.EXPIRED,
        actor: TripActorEnum.SYSTEM,
        actorId: null,
      });
    });

    it.each([
      [
        'moved on or is not yet due',
        new ConflictException('Trip 3 is already CANCELLED'),
      ],
      ['no longer exists', new NotFoundException('Trip 3 not found')],
    ])('returns false when the trip %s', async (_case, error) => {
      tripService.transition.mockRejectedValue(error);

      await expect(expiry.expire(3)).resolves.toBe(false);
    });

    it('rethrows anything else, so the job fails visibly', async () => {
      tripService.transition.mockRejectedValue(new Error('connection lost'));

      await expect(expiry.expire(3)).rejects.toThrow('connection lost');
    });
  });

  describe('expireDueTrips', () => {
    it('looks up REQUESTED trips past their deadline, earliest first, one batch at a time', async () => {
      const before = dayjs();

      await expiry.expireDueTrips();

      const [{ where, order, take }] = tripRepository.find.mock.calls[0] as [
        {
          where: { status: TripStatusEnum; expiresAt: FindOperator<Date> };
          order: unknown;
          take: number;
        },
      ];

      expect(where.status).toBe(TripStatusEnum.REQUESTED);
      expect(where.expiresAt.type).toBe('lessThanOrEqual');
      expect(dayjs(where.expiresAt.value).isBefore(before)).toBe(false);
      expect(order).toEqual({ expiresAt: 'ASC' });
      expect(take).toBe(BATCH_SIZE);
    });

    it('expires each due trip and counts only the ones it changed', async () => {
      dueTrips(3, 4, 5);
      tripService.transition
        .mockResolvedValueOnce({} as TripEntity)
        .mockRejectedValueOnce(
          new ConflictException('Trip 4 is already CANCELLED'),
        )
        .mockResolvedValueOnce({} as TripEntity);

      await expect(expiry.expireDueTrips()).resolves.toBe(2);

      expect(tripService.transition).toHaveBeenCalledTimes(3);
    });

    it('keeps going after an unexpected failure on one trip', async () => {
      dueTrips(3, 4);
      tripService.transition.mockRejectedValueOnce(
        new Error('connection lost'),
      );

      await expect(expiry.expireDueTrips()).resolves.toBe(1);

      expect(tripService.transition).toHaveBeenLastCalledWith(
        expect.objectContaining({ tripId: 4 }),
      );
    });

    it('does nothing when no trip is due', async () => {
      await expect(expiry.expireDueTrips()).resolves.toBe(0);

      expect(tripService.transition).not.toHaveBeenCalled();
    });
  });
});
