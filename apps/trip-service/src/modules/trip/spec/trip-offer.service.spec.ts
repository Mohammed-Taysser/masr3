import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  QueryFailedError,
  Repository,
} from 'typeorm';

import {
  AuthenticatedUser,
  dayjs,
  TripActorEnum,
  TripStatusEnum,
  UserRoleEnum,
} from '@masr3/libs';

import TripOfferEntity from '../entities/trip-offer.entity';
import TripEntity from '../entities/trip.entity';
import TripOfferService from '../trip-offer.service';
import {
  UQ_TRIP_OFFERS_PENDING_DRIVER,
  UQ_TRIPS_ACTIVE_DRIVER,
} from '../trip.constant';
import { TripOfferStatusEnum } from '../trip.enum';
import TripService from '../trip.service';

const uniqueViolation = (constraint: string) =>
  new QueryFailedError(
    'INSERT',
    [],
    Object.assign(new Error('duplicate'), { code: '23505', constraint }),
  );

const user = (role: UserRoleEnum, id: number) =>
  ({ id, role, email: 'x@masr3.local', tokenVersion: 0 }) as AuthenticatedUser;

describe('TripOfferService', () => {
  let service: TripOfferService;
  let manager: jest.Mocked<EntityManager>;
  let tripService: jest.Mocked<TripService>;
  let tripRepository: jest.Mocked<Repository<TripEntity>>;
  let offerRepository: jest.Mocked<Repository<TripOfferEntity>>;

  const driver = user(UserRoleEnum.DRIVER, 5);
  const customer = user(UserRoleEnum.CUSTOMER, 1);

  const openTrip = () =>
    ({
      id: 7,
      customerId: 1,
      driverId: null,
      status: TripStatusEnum.REQUESTED,
      expiresAt: dayjs().add(5, 'minute').toDate(),
    }) as TripEntity;

  const pendingOffer = {
    id: 12,
    tripId: 7,
    driverId: 5,
    amount: 90,
    status: TripOfferStatusEnum.PENDING,
  } as TripOfferEntity;

  beforeEach(() => {
    manager = {
      findOne: jest.fn(),
      exists: jest.fn().mockResolvedValue(false),
      create: jest.fn((_entity, values) => values),
      save: jest.fn(async (values) => ({ ...values, id: 12 })),
    } as unknown as jest.Mocked<EntityManager>;

    const dataSource = {
      transaction: jest.fn((work: (m: EntityManager) => unknown) =>
        work(manager),
      ),
    } as unknown as DataSource;

    tripService = {
      applyTransition: jest.fn(),
    } as unknown as jest.Mocked<TripService>;

    tripRepository = {
      findOneBy: jest.fn(),
    } as unknown as jest.Mocked<Repository<TripEntity>>;

    offerRepository = {
      find: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      findOneBy: jest.fn(),
      findOneByOrFail: jest.fn(),
    } as unknown as jest.Mocked<Repository<TripOfferEntity>>;

    service = new TripOfferService(
      dataSource,
      tripService,
      tripRepository,
      offerRepository,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('locks the trip FOR SHARE and saves a PENDING offer', async () => {
      manager.findOne.mockResolvedValue(openTrip());

      const offer = await service.create(7, driver, 90);

      expect(manager.findOne).toHaveBeenCalledWith(TripEntity, {
        where: { id: 7 },
        lock: { mode: 'pessimistic_read' },
      });
      expect(manager.create).toHaveBeenCalledWith(TripOfferEntity, {
        tripId: 7,
        driverId: 5,
        amount: 90,
        status: TripOfferStatusEnum.PENDING,
      });
      expect(offer.id).toBe(12);
    });

    it('answers 404 for a missing trip', async () => {
      manager.findOne.mockResolvedValue(null);

      await expect(service.create(7, driver, 90)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('conflicts when the trip is no longer REQUESTED', async () => {
      manager.findOne.mockResolvedValue({
        ...openTrip(),
        status: TripStatusEnum.ACCEPTED,
      });

      await expect(service.create(7, driver, 90)).rejects.toThrow(
        new ConflictException('The trip is no longer open for offers'),
      );
    });

    it('conflicts when the request has expired', async () => {
      manager.findOne.mockResolvedValue({
        ...openTrip(),
        expiresAt: dayjs().subtract(1, 'second').toDate(),
      });

      await expect(service.create(7, driver, 90)).rejects.toThrow(
        new ConflictException('The trip request has expired'),
      );
    });

    it('conflicts when the driver already has an active trip', async () => {
      manager.findOne.mockResolvedValue(openTrip());
      manager.exists.mockResolvedValue(true);

      await expect(service.create(7, driver, 90)).rejects.toThrow(
        new ConflictException('You already have an active trip'),
      );
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('conflicts on a second pending offer from the same driver', async () => {
      manager.findOne.mockResolvedValue(openTrip());
      manager.save.mockRejectedValue(
        uniqueViolation(UQ_TRIP_OFFERS_PENDING_DRIVER),
      );

      await expect(service.create(7, driver, 90)).rejects.toThrow(
        new ConflictException('You already have a pending offer on this trip'),
      );
    });
  });

  describe('listForTrip', () => {
    it.each([
      ['its customer', customer],
      ['an admin', user(UserRoleEnum.ADMIN, 9)],
    ])('lists offers for %s', async (_who, caller) => {
      tripRepository.findOneBy.mockResolvedValue(openTrip());
      offerRepository.find.mockResolvedValue([pendingOffer]);

      await expect(service.listForTrip(7, caller)).resolves.toEqual([
        pendingOffer,
      ]);
    });

    it('hides another customer’s trip', async () => {
      tripRepository.findOneBy.mockResolvedValue(openTrip());

      await expect(
        service.listForTrip(7, user(UserRoleEnum.CUSTOMER, 2)),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('accept', () => {
    it('looks the offer up through the caller’s trip and applies the transition', async () => {
      manager.findOne.mockResolvedValue(pendingOffer);

      await service.accept(7, 12, customer);

      expect(manager.findOne).toHaveBeenCalledWith(TripOfferEntity, {
        where: { id: 12, tripId: 7, trip: { customerId: 1 } },
      });
      expect(tripService.applyTransition).toHaveBeenCalledWith(manager, {
        tripId: 7,
        to: TripStatusEnum.ACCEPTED,
        actor: TripActorEnum.CUSTOMER,
        actorId: 1,
        changes: { driverId: 5, agreedFare: 90 },
        acceptedOfferId: 12,
      });
    });

    it('answers 404 when the offer is missing or not the caller’s', async () => {
      manager.findOne.mockResolvedValue(null);

      await expect(service.accept(7, 12, customer)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('conflicts when the offer is no longer pending', async () => {
      manager.findOne.mockResolvedValue({
        ...pendingOffer,
        status: TripOfferStatusEnum.WITHDRAWN,
      });

      await expect(service.accept(7, 12, customer)).rejects.toThrow(
        new ConflictException('The offer is no longer pending'),
      );
      expect(tripService.applyTransition).not.toHaveBeenCalled();
    });

    it('conflicts when the driver took another trip meanwhile', async () => {
      manager.findOne.mockResolvedValue(pendingOffer);
      tripService.applyTransition.mockRejectedValue(
        uniqueViolation(UQ_TRIPS_ACTIVE_DRIVER),
      );

      await expect(service.accept(7, 12, customer)).rejects.toThrow(
        new ConflictException('The driver already has an active trip'),
      );
    });
  });

  describe('withdraw', () => {
    it('withdraws the driver’s pending offer', async () => {
      offerRepository.findOneByOrFail.mockResolvedValue({
        ...pendingOffer,
        status: TripOfferStatusEnum.WITHDRAWN,
      });

      const offer = await service.withdraw(7, 12, driver);

      expect(offerRepository.update).toHaveBeenCalledWith(
        { id: 12, tripId: 7, driverId: 5, status: TripOfferStatusEnum.PENDING },
        { status: TripOfferStatusEnum.WITHDRAWN },
      );
      expect(offer.status).toBe(TripOfferStatusEnum.WITHDRAWN);
    });

    it('answers 404 when the offer is not the driver’s', async () => {
      offerRepository.update.mockResolvedValue({
        affected: 0,
        raw: [],
        generatedMaps: [],
      });
      offerRepository.findOneBy.mockResolvedValue(null);

      await expect(service.withdraw(7, 12, driver)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('conflicts when the offer is already closed', async () => {
      offerRepository.update.mockResolvedValue({
        affected: 0,
        raw: [],
        generatedMaps: [],
      });
      offerRepository.findOneBy.mockResolvedValue({
        ...pendingOffer,
        status: TripOfferStatusEnum.REJECTED,
      });

      await expect(service.withdraw(7, 12, driver)).rejects.toThrow(
        new ConflictException('The offer is no longer pending'),
      );
    });
  });
});
