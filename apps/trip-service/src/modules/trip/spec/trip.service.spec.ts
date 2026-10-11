import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DataSource,
  EntityManager,
  QueryFailedError,
  Repository,
} from 'typeorm';

import { dayjs } from '@masr3/libs';

import TripStatusHistoryEntity from '../entities/trip-status-history.entity';
import TripEntity from '../entities/trip.entity';
import {
  UQ_TRIPS_ACTIVE_CUSTOMER,
  UQ_TRIPS_ACTIVE_DRIVER,
} from '../trip.constant';
import { TripActorEnum, TripStatusEnum, TripTypeEnum } from '../trip.enum';
import { CreateTripCommand } from '../trip.interface';
import TripService from '../trip.service';

const TTL_MS = 600000;

const uniqueViolation = (constraint: string) =>
  new QueryFailedError(
    'INSERT',
    [],
    Object.assign(new Error('duplicate'), { code: '23505', constraint }),
  );

describe('TripService', () => {
  let service: TripService;
  let manager: jest.Mocked<EntityManager>;
  let dataSource: jest.Mocked<DataSource>;
  let historyRepository: jest.Mocked<Repository<TripStatusHistoryEntity>>;

  const command: CreateTripCommand = {
    customerId: 1,
    type: TripTypeEnum.RIDE,
    pickupLatitude: 30.04442,
    pickupLongitude: 31.235712,
    pickupAddress: 'Tahrir Square',
    dropoffLatitude: 30.0131,
    dropoffLongitude: 31.2089,
    dropoffAddress: 'Giza',
    proposedFare: 85.5,
  };

  const trip = {
    id: 7,
    customerId: 1,
    driverId: null,
    status: TripStatusEnum.REQUESTED,
  } as TripEntity;

  beforeEach(() => {
    manager = {
      create: jest.fn((_entity, values) => values),
      save: jest.fn(async (values) => ({ ...values, id: trip.id })),
      insert: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      findOneByOrFail: jest.fn(),
    } as unknown as jest.Mocked<EntityManager>;

    dataSource = {
      transaction: jest.fn((work: (m: EntityManager) => unknown) =>
        work(manager),
      ),
    } as unknown as jest.Mocked<DataSource>;

    historyRepository = {
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<TripStatusHistoryEntity>>;

    const configService = {
      getOrThrow: jest.fn().mockReturnValue(TTL_MS),
    } as unknown as ConfigService;

    service = new TripService(dataSource, configService, historyRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('writes a REQUESTED trip and its creation history row in one transaction', async () => {
      const result = await service.create(command);

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(manager.create).toHaveBeenCalledWith(
        TripEntity,
        expect.objectContaining({
          ...command,
          status: TripStatusEnum.REQUESTED,
          expiresAt: expect.any(Date),
        }),
      );
      expect(manager.insert).toHaveBeenCalledWith(TripStatusHistoryEntity, {
        tripId: trip.id,
        fromStatus: null,
        toStatus: TripStatusEnum.REQUESTED,
        actor: TripActorEnum.CUSTOMER,
        actorId: command.customerId,
        reason: null,
      });
      expect(result.id).toBe(trip.id);
    });

    it('expires the request after TRIP_REQUEST_TTL_MS', async () => {
      const before = dayjs();

      await service.create(command);

      const { expiresAt } = manager.create.mock
        .calls[0][1] as unknown as TripEntity;
      const ttl = dayjs(expiresAt).diff(before, 'millisecond');

      expect(ttl).toBeGreaterThanOrEqual(TTL_MS);
      expect(ttl).toBeLessThan(TTL_MS + 5000);
    });

    it('turns the active-customer index violation into a conflict', async () => {
      manager.save.mockRejectedValue(uniqueViolation(UQ_TRIPS_ACTIVE_CUSTOMER));

      await expect(service.create(command)).rejects.toThrow(
        new ConflictException('The customer already has an active trip'),
      );
    });

    it('rethrows any other unique violation', async () => {
      const error = uniqueViolation('UQ_something_else');

      manager.save.mockRejectedValue(error);

      await expect(service.create(command)).rejects.toBe(error);
    });
  });

  describe('transition', () => {
    it('answers 404 for a missing trip', async () => {
      manager.findOne.mockResolvedValue(null);

      await expect(
        service.transition({
          tripId: 404,
          to: TripStatusEnum.CANCELLED,
          actor: TripActorEnum.ADMIN,
          actorId: 9,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('locks the row, applies the change and records the old status', async () => {
      const accepted = {
        ...trip,
        status: TripStatusEnum.ACCEPTED,
        driverId: 2,
        agreedFare: 90,
      } as TripEntity;

      manager.findOne.mockResolvedValue({ ...trip });
      manager.findOneByOrFail.mockResolvedValue(accepted);

      const result = await service.transition({
        tripId: trip.id,
        to: TripStatusEnum.ACCEPTED,
        actor: TripActorEnum.CUSTOMER,
        actorId: trip.customerId,
        changes: { driverId: 2, agreedFare: 90 },
      });

      expect(manager.findOne).toHaveBeenCalledWith(TripEntity, {
        where: { id: trip.id },
        lock: { mode: 'pessimistic_write' },
      });
      expect(manager.update).toHaveBeenCalledWith(
        TripEntity,
        { id: trip.id },
        { driverId: 2, agreedFare: 90, status: TripStatusEnum.ACCEPTED },
      );
      expect(manager.insert).toHaveBeenCalledWith(TripStatusHistoryEntity, {
        tripId: trip.id,
        fromStatus: TripStatusEnum.REQUESTED,
        toStatus: TripStatusEnum.ACCEPTED,
        actor: TripActorEnum.CUSTOMER,
        actorId: trip.customerId,
        reason: null,
      });
      expect(result).toBe(accepted);
    });

    it('writes nothing when the move is not allowed', async () => {
      manager.findOne.mockResolvedValue({ ...trip });

      await expect(
        service.transition({
          tripId: trip.id,
          to: TripStatusEnum.EXPIRED,
          actor: TripActorEnum.ADMIN,
          actorId: 9,
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(manager.update).not.toHaveBeenCalled();
      expect(manager.insert).not.toHaveBeenCalled();
    });

    it('turns the active-driver index violation into a conflict', async () => {
      manager.findOne.mockResolvedValue({ ...trip });
      manager.update.mockRejectedValue(uniqueViolation(UQ_TRIPS_ACTIVE_DRIVER));

      await expect(
        service.transition({
          tripId: trip.id,
          to: TripStatusEnum.ACCEPTED,
          actor: TripActorEnum.CUSTOMER,
          actorId: trip.customerId,
          changes: { driverId: 2, agreedFare: 90 },
        }),
      ).rejects.toThrow(
        new ConflictException('The driver already has an active trip'),
      );
    });
  });

  describe('findHistory', () => {
    it('returns the history oldest first', async () => {
      historyRepository.find.mockResolvedValue([]);

      await service.findHistory(trip.id);

      expect(historyRepository.find).toHaveBeenCalledWith({
        where: { tripId: trip.id },
        order: { createdAt: 'ASC', id: 'ASC' },
      });
    });
  });
});
