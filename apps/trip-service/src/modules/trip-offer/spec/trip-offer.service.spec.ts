import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  QueryFailedError,
  Repository,
} from 'typeorm';

import { AuthenticatedUser, UserRoleEnum } from '@masr3/libs/auth';
import { dayjs } from '@masr3/libs/date';
import {
  AuditActionEnum,
  AuditActorTypeEnum,
  AuditEntityTypeEnum,
  TripActorEnum,
  TripStatusEnum,
} from '@masr3/libs/kafka';

import TripOfferEntity from '../entities/trip-offer.entity';
import AuditRecorderService from '../../audit/audit-recorder.service';
import TripEntity from '../../trip/entities/trip.entity';
import TripOfferService from '../trip-offer.service';
import { UQ_TRIPS_ACTIVE_DRIVER } from '../../trip/trip.constant';
import TripService from '../../trip/trip.service';
import UserService from '../../user/user.service';
import { UQ_TRIP_OFFERS_PENDING_DRIVER } from '../trip-offer.constant';
import { TripOfferStatusEnum } from '../trip-offer.enum';

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
  let auditRecorder: jest.Mocked<AuditRecorderService>;
  let tripRepository: jest.Mocked<Repository<TripEntity>>;
  let offerRepository: jest.Mocked<Repository<TripOfferEntity>>;
  let userService: jest.Mocked<UserService>;

  const driver = user(UserRoleEnum.DRIVER, 5);
  const customer = user(UserRoleEnum.CUSTOMER, 1);
  const admin = user(UserRoleEnum.ADMIN, 9);

  const openTrip = () =>
    ({
      id: 7,
      customerId: 1,
      driverId: null,
      status: TripStatusEnum.REQUESTED,
      expiresAt: dayjs().add(5, 'minute').toDate(),
    }) as TripEntity;

  const driverActor = {
    type: AuditActorTypeEnum.USER,
    id: 5,
    role: UserRoleEnum.DRIVER,
  };

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
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      findOneByOrFail: jest.fn(),
    } as unknown as jest.Mocked<EntityManager>;

    const dataSource = {
      transaction: jest.fn((work: (m: EntityManager) => unknown) =>
        work(manager),
      ),
    } as unknown as DataSource;

    tripService = {
      applyTransition: jest.fn(),
    } as unknown as jest.Mocked<TripService>;

    auditRecorder = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditRecorderService>;

    tripRepository = {
      findOneBy: jest.fn(),
    } as unknown as jest.Mocked<Repository<TripEntity>>;

    offerRepository = {
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<TripOfferEntity>>;

    userService = {
      findActiveOrFail: jest.fn(),
    } as unknown as jest.Mocked<UserService>;

    service = new TripOfferService(
      dataSource,
      tripService,
      auditRecorder,
      userService,
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

      const offer = await service.create(7, { amount: 90 }, driver);

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
      expect(auditRecorder.record).toHaveBeenCalledWith(manager, {
        action: AuditActionEnum.SUBMITTED,
        entity: { type: AuditEntityTypeEnum.TRIP_OFFER, id: 12 },
        actor: driverActor,
        changes: {
          tripId: { old: null, new: 7 },
          driverId: { old: null, new: 5 },
          amount: { old: null, new: 90 },
          status: { old: null, new: TripOfferStatusEnum.PENDING },
        },
        metadata: null,
      });
    });

    it('answers 404 for a missing trip', async () => {
      manager.findOne.mockResolvedValue(null);

      await expect(service.create(7, { amount: 90 }, driver)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('conflicts when the trip is no longer REQUESTED', async () => {
      manager.findOne.mockResolvedValue({
        ...openTrip(),
        status: TripStatusEnum.ACCEPTED,
      });

      await expect(service.create(7, { amount: 90 }, driver)).rejects.toThrow(
        new ConflictException('The trip is no longer open for offers'),
      );
    });

    it('conflicts when the request has expired', async () => {
      manager.findOne.mockResolvedValue({
        ...openTrip(),
        expiresAt: dayjs().subtract(1, 'second').toDate(),
      });

      await expect(service.create(7, { amount: 90 }, driver)).rejects.toThrow(
        new ConflictException('The trip request has expired'),
      );
    });

    it('conflicts when the driver already has an active trip', async () => {
      manager.findOne.mockResolvedValue(openTrip());
      manager.exists.mockResolvedValue(true);

      await expect(service.create(7, { amount: 90 }, driver)).rejects.toThrow(
        new ConflictException('The driver already has an active trip'),
      );
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('conflicts on a second pending offer from the same driver', async () => {
      manager.findOne.mockResolvedValue(openTrip());
      manager.save.mockRejectedValue(
        uniqueViolation(UQ_TRIP_OFFERS_PENDING_DRIVER),
      );

      await expect(service.create(7, { amount: 90 }, driver)).rejects.toThrow(
        new ConflictException(
          'The driver already has a pending offer on this trip',
        ),
      );
    });
  });

  describe('create — by an admin', () => {
    it('offers for the named driver, checked against the users copy, audited as the admin', async () => {
      manager.findOne.mockResolvedValue(openTrip());

      await service.create(7, { amount: 90, driverId: 5 }, admin);

      expect(userService.findActiveOrFail).toHaveBeenCalledWith(
        5,
        UserRoleEnum.DRIVER,
      );
      expect(manager.create).toHaveBeenCalledWith(
        TripOfferEntity,
        expect.objectContaining({ driverId: 5 }),
      );
      expect(auditRecorder.record).toHaveBeenCalledWith(
        manager,
        expect.objectContaining({
          actor: {
            type: AuditActorTypeEnum.USER,
            id: 9,
            role: UserRoleEnum.ADMIN,
          },
        }),
      );
    });

    it('writes nothing when the named driver is deactivated', async () => {
      userService.findActiveOrFail.mockRejectedValue(
        new ConflictException('DRIVER 5 is deactivated'),
      );

      await expect(
        service.create(7, { amount: 90, driverId: 5 }, admin),
      ).rejects.toThrow(ConflictException);
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('does not consult the users copy when a driver offers for themselves', async () => {
      manager.findOne.mockResolvedValue(openTrip());

      await service.create(7, { amount: 90 }, driver);

      expect(userService.findActiveOrFail).not.toHaveBeenCalled();
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
    const offerOnTrip = {
      ...pendingOffer,
      trip: openTrip(),
    } as TripOfferEntity;

    it('loads the offer with its trip and applies the transition as the customer', async () => {
      manager.findOne.mockResolvedValue(offerOnTrip);

      await service.accept(7, 12, customer);

      expect(manager.findOne).toHaveBeenCalledWith(TripOfferEntity, {
        where: { id: 12, tripId: 7 },
        relations: { trip: true },
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

    it('lets an admin accept for the customer, as an ADMIN actor', async () => {
      manager.findOne.mockResolvedValue(offerOnTrip);

      await service.accept(7, 12, admin);

      expect(tripService.applyTransition).toHaveBeenCalledWith(
        manager,
        expect.objectContaining({ actor: TripActorEnum.ADMIN, actorId: 9 }),
      );
    });

    it('answers 404 when the offer is missing', async () => {
      manager.findOne.mockResolvedValue(null);

      await expect(service.accept(7, 12, customer)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('answers 404 to another customer, even for a closed offer', async () => {
      manager.findOne.mockResolvedValue({
        ...offerOnTrip,
        status: TripOfferStatusEnum.WITHDRAWN,
      });

      await expect(
        service.accept(7, 12, user(UserRoleEnum.CUSTOMER, 2)),
      ).rejects.toThrow(NotFoundException);
    });

    it('conflicts when the offer is no longer pending', async () => {
      manager.findOne.mockResolvedValue({
        ...offerOnTrip,
        status: TripOfferStatusEnum.WITHDRAWN,
      });

      await expect(service.accept(7, 12, customer)).rejects.toThrow(
        new ConflictException('The offer is no longer pending'),
      );
      expect(tripService.applyTransition).not.toHaveBeenCalled();
    });

    it('conflicts when the driver took another trip meanwhile', async () => {
      manager.findOne.mockResolvedValue(offerOnTrip);
      tripService.applyTransition.mockRejectedValue(
        uniqueViolation(UQ_TRIPS_ACTIVE_DRIVER),
      );

      await expect(service.accept(7, 12, customer)).rejects.toThrow(
        new ConflictException('The driver already has an active trip'),
      );
    });
  });

  describe('withdraw', () => {
    it('locks the driver’s pending offer, withdraws it and audits the change', async () => {
      manager.findOne.mockResolvedValue({ ...pendingOffer });
      manager.findOneByOrFail.mockResolvedValue({
        ...pendingOffer,
        status: TripOfferStatusEnum.WITHDRAWN,
      });

      const offer = await service.withdraw(7, 12, driver);

      expect(manager.findOne).toHaveBeenCalledWith(TripOfferEntity, {
        where: { id: 12, tripId: 7 },
        lock: { mode: 'pessimistic_write' },
      });
      expect(manager.update).toHaveBeenCalledWith(
        TripOfferEntity,
        { id: 12 },
        { status: TripOfferStatusEnum.WITHDRAWN },
      );
      expect(offer.status).toBe(TripOfferStatusEnum.WITHDRAWN);
      expect(auditRecorder.record).toHaveBeenCalledWith(manager, {
        action: AuditActionEnum.WITHDRAWN,
        entity: { type: AuditEntityTypeEnum.TRIP_OFFER, id: 12 },
        actor: driverActor,
        changes: {
          status: {
            old: TripOfferStatusEnum.PENDING,
            new: TripOfferStatusEnum.WITHDRAWN,
          },
        },
        metadata: null,
      });
    });

    it('answers 404 when the offer is missing', async () => {
      manager.findOne.mockResolvedValue(null);

      await expect(service.withdraw(7, 12, driver)).rejects.toThrow(
        NotFoundException,
      );
      expect(auditRecorder.record).not.toHaveBeenCalled();
    });

    it('answers 404 when the offer is another driver’s', async () => {
      manager.findOne.mockResolvedValue({ ...pendingOffer });

      await expect(
        service.withdraw(7, 12, user(UserRoleEnum.DRIVER, 6)),
      ).rejects.toThrow(NotFoundException);
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('lets an admin withdraw it for the driver, audited as the admin', async () => {
      manager.findOne.mockResolvedValue({ ...pendingOffer });
      manager.findOneByOrFail.mockResolvedValue({
        ...pendingOffer,
        status: TripOfferStatusEnum.WITHDRAWN,
      });

      await service.withdraw(7, 12, admin);

      expect(auditRecorder.record).toHaveBeenCalledWith(
        manager,
        expect.objectContaining({
          actor: expect.objectContaining({ id: 9, role: UserRoleEnum.ADMIN }),
        }),
      );
    });

    it('conflicts when the offer is already closed', async () => {
      manager.findOne.mockResolvedValue({
        ...pendingOffer,
        status: TripOfferStatusEnum.REJECTED,
      });

      await expect(service.withdraw(7, 12, driver)).rejects.toThrow(
        new ConflictException('The offer is no longer pending'),
      );
      expect(manager.update).not.toHaveBeenCalled();
      expect(auditRecorder.record).not.toHaveBeenCalled();
    });
  });
});
