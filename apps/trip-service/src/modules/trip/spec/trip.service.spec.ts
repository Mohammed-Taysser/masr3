import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
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
  TripKafkaTopic,
  TripStatusEnum,
  TripTypeEnum,
  UserRoleEnum,
} from '@masr3/libs';

import OutboxService from '../../outbox/outbox.service';
import TripOfferEntity from '../entities/trip-offer.entity';
import TripStatusHistoryEntity from '../entities/trip-status-history.entity';
import TripEntity from '../entities/trip.entity';
import {
  UQ_TRIPS_ACTIVE_CUSTOMER,
  UQ_TRIPS_ACTIVE_DRIVER,
} from '../trip.constant';
import { TripExpiryJobEnum, TripOfferStatusEnum } from '../trip.enum';
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
  let tripRepository: jest.Mocked<Repository<TripEntity>>;
  let outboxService: jest.Mocked<OutboxService>;
  let expiryQueue: jest.Mocked<Queue>;

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
    expiresAt: dayjs().add(10, 'minute').toDate(),
  } as TripEntity;

  beforeEach(() => {
    manager = {
      create: jest.fn((_entity, values) => values),
      save: jest.fn(async (values) => ({ ...values, id: trip.id })),
      insert: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
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

    tripRepository = {
      findOneBy: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    } as unknown as jest.Mocked<Repository<TripEntity>>;

    const configService = {
      getOrThrow: jest.fn().mockReturnValue(TTL_MS),
    } as unknown as ConfigService;

    outboxService = {
      enqueue: jest.fn(),
    } as unknown as jest.Mocked<OutboxService>;

    expiryQueue = {
      add: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<Queue>;

    service = new TripService(
      dataSource,
      configService,
      outboxService,
      tripRepository,
      historyRepository,
      expiryQueue,
    );
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

    it('enqueues a REQUESTED status-changed event in the same transaction', async () => {
      await service.create(command);

      expect(outboxService.enqueue).toHaveBeenCalledWith(
        manager,
        TripKafkaTopic.STATUS_CHANGED,
        expect.objectContaining({
          tripId: trip.id,
          type: TripTypeEnum.RIDE,
          customerId: command.customerId,
          driverId: null,
          fromStatus: null,
          toStatus: TripStatusEnum.REQUESTED,
          actor: TripActorEnum.CUSTOMER,
          actorId: command.customerId,
          reason: null,
          pickupAddress: command.pickupAddress,
          dropoffAddress: command.dropoffAddress,
          proposedFare: command.proposedFare,
          agreedFare: null,
          currency: 'EGP',
        }),
        String(trip.id),
      );
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

    it('queues an EXPIRE_TRIP job delayed until the deadline, after the commit', async () => {
      await service.create(command);

      const [name, data, options] = expiryQueue.add.mock.calls[0] as [
        string,
        { tripId: number },
        { jobId: string; delay: number },
      ];

      expect(name).toBe(TripExpiryJobEnum.EXPIRE_TRIP);
      expect(data).toEqual({ tripId: trip.id });
      expect(options.jobId).toBe(`trip-${trip.id}`);
      expect(options.delay).toBeGreaterThan(TTL_MS - 1000);
      expect(options.delay).toBeLessThanOrEqual(TTL_MS);
    });

    it('still creates the trip when the expiry job cannot be queued', async () => {
      expiryQueue.add.mockRejectedValue(new Error('Redis is down'));

      await expect(service.create(command)).resolves.toMatchObject({
        id: trip.id,
      });
    });

    it('queues nothing when the transaction fails', async () => {
      dataSource.transaction.mockRejectedValue(
        uniqueViolation(UQ_TRIPS_ACTIVE_CUSTOMER),
      );

      await expect(service.create(command)).rejects.toThrow(ConflictException);
      expect(expiryQueue.add).not.toHaveBeenCalled();
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
      expect(outboxService.enqueue).toHaveBeenCalledWith(
        manager,
        TripKafkaTopic.STATUS_CHANGED,
        expect.objectContaining({
          tripId: trip.id,
          driverId: 2,
          agreedFare: 90,
          fromStatus: TripStatusEnum.REQUESTED,
          toStatus: TripStatusEnum.ACCEPTED,
          actor: TripActorEnum.CUSTOMER,
        }),
        String(trip.id),
      );
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
      expect(outboxService.enqueue).not.toHaveBeenCalled();
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

  describe('create — parcel details', () => {
    it('drops parcel fields on a ride', async () => {
      await service.create({ ...command, recipientName: 'Mona' });

      expect(manager.create).toHaveBeenCalledWith(
        TripEntity,
        expect.objectContaining({
          recipientName: null,
          recipientPhone: null,
          packageDescription: null,
        }),
      );
    });

    it('keeps parcel fields on a parcel', async () => {
      await service.create({
        ...command,
        type: TripTypeEnum.PARCEL,
        recipientName: 'Mona',
        recipientPhone: '+201001234567',
      });

      expect(manager.create).toHaveBeenCalledWith(
        TripEntity,
        expect.objectContaining({
          recipientName: 'Mona',
          recipientPhone: '+201001234567',
        }),
      );
    });
  });

  describe('applyTransition — pending offers', () => {
    beforeEach(() => {
      manager.findOneByOrFail.mockResolvedValue({ ...trip } as TripEntity);
    });

    it.each([
      [
        TripStatusEnum.CANCELLED,
        TripActorEnum.CUSTOMER,
        1,
        TripOfferStatusEnum.REJECTED,
      ],
      [
        TripStatusEnum.EXPIRED,
        TripActorEnum.SYSTEM,
        null,
        TripOfferStatusEnum.EXPIRED,
      ],
    ])(
      'closes pending offers when the trip moves to %s',
      async (to, actor, actorId, closedAs) => {
        manager.findOne.mockResolvedValue({
          ...trip,
          expiresAt: dayjs().subtract(1, 'second').toDate(),
        });

        await service.applyTransition(manager, {
          tripId: trip.id,
          to,
          actor,
          actorId,
        });

        expect(manager.update).toHaveBeenCalledWith(
          TripOfferEntity,
          { tripId: trip.id, status: TripOfferStatusEnum.PENDING },
          { status: closedAs },
        );
      },
    );

    it('marks the accepted offer ACCEPTED and rejects the rest', async () => {
      manager.findOne.mockResolvedValue({ ...trip });

      await service.applyTransition(manager, {
        tripId: trip.id,
        to: TripStatusEnum.ACCEPTED,
        actor: TripActorEnum.CUSTOMER,
        actorId: trip.customerId,
        changes: { driverId: 2, agreedFare: 90 },
        acceptedOfferId: 12,
      });

      expect(manager.update).toHaveBeenCalledWith(
        TripOfferEntity,
        { id: 12, tripId: trip.id, status: TripOfferStatusEnum.PENDING },
        { status: TripOfferStatusEnum.ACCEPTED },
      );
      expect(manager.update).toHaveBeenCalledWith(
        TripOfferEntity,
        { tripId: trip.id, status: TripOfferStatusEnum.PENDING },
        { status: TripOfferStatusEnum.REJECTED },
      );
    });

    it('conflicts when the accepted offer is no longer pending', async () => {
      manager.findOne.mockResolvedValue({ ...trip });
      manager.update
        .mockResolvedValueOnce({ affected: 1, raw: [], generatedMaps: [] })
        .mockResolvedValueOnce({ affected: 0, raw: [], generatedMaps: [] });

      await expect(
        service.applyTransition(manager, {
          tripId: trip.id,
          to: TripStatusEnum.ACCEPTED,
          actor: TripActorEnum.CUSTOMER,
          actorId: trip.customerId,
          acceptedOfferId: 12,
        }),
      ).rejects.toThrow(
        new ConflictException('The offer is no longer pending'),
      );

      expect(manager.insert).not.toHaveBeenCalled();
      expect(outboxService.enqueue).not.toHaveBeenCalled();
    });

    it('refuses to accept a request past its deadline, writing nothing', async () => {
      manager.findOne.mockResolvedValue({
        ...trip,
        expiresAt: dayjs().subtract(1, 'second').toDate(),
      });

      await expect(
        service.applyTransition(manager, {
          tripId: trip.id,
          to: TripStatusEnum.ACCEPTED,
          actor: TripActorEnum.CUSTOMER,
          actorId: trip.customerId,
          changes: { driverId: 2, agreedFare: 90 },
          acceptedOfferId: 12,
        }),
      ).rejects.toThrow(new ConflictException('The trip request has expired'));

      expect(manager.update).not.toHaveBeenCalled();
      expect(manager.insert).not.toHaveBeenCalled();
      expect(outboxService.enqueue).not.toHaveBeenCalled();
    });

    it('refuses to expire a request before its deadline', async () => {
      manager.findOne.mockResolvedValue({ ...trip });

      await expect(
        service.applyTransition(manager, {
          tripId: trip.id,
          to: TripStatusEnum.EXPIRED,
          actor: TripActorEnum.SYSTEM,
          actorId: null,
        }),
      ).rejects.toThrow(
        new ConflictException('The trip request has not expired yet'),
      );
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('still lets the customer cancel a request past its deadline', async () => {
      manager.findOne.mockResolvedValue({
        ...trip,
        expiresAt: dayjs().subtract(1, 'second').toDate(),
      });

      await service.applyTransition(manager, {
        tripId: trip.id,
        to: TripStatusEnum.CANCELLED,
        actor: TripActorEnum.CUSTOMER,
        actorId: trip.customerId,
      });

      expect(manager.update).toHaveBeenCalledWith(
        TripEntity,
        { id: trip.id },
        { status: TripStatusEnum.CANCELLED },
      );
    });

    it('leaves offers alone once the trip has left REQUESTED', async () => {
      manager.findOne.mockResolvedValue({
        ...trip,
        status: TripStatusEnum.ACCEPTED,
        driverId: 2,
      });

      await service.applyTransition(manager, {
        tripId: trip.id,
        to: TripStatusEnum.DRIVER_ARRIVED,
        actor: TripActorEnum.DRIVER,
        actorId: 2,
      });

      expect(manager.update).not.toHaveBeenCalledWith(
        TripOfferEntity,
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe('visibility', () => {
    const user = (role: UserRoleEnum, id: number) =>
      ({
        id,
        role,
        email: 'x@masr3.local',
        tokenVersion: 0,
      }) as AuthenticatedUser;
    const parcel = {
      ...trip,
      type: TripTypeEnum.PARCEL,
      recipientName: 'Mona',
      recipientPhone: '+201001234567',
    } as TripEntity;

    it('shows a REQUESTED trip to any driver, without recipient contact', async () => {
      tripRepository.findOneBy.mockResolvedValue(parcel);

      const result = await service.findVisibleTrip(
        trip.id,
        user(UserRoleEnum.DRIVER, 99),
      );

      expect(result.recipientName).toBeNull();
      expect(result.recipientPhone).toBeNull();
    });

    it('shows the customer their own trip in full', async () => {
      tripRepository.findOneBy.mockResolvedValue(parcel);

      const result = await service.findVisibleTrip(
        trip.id,
        user(UserRoleEnum.CUSTOMER, 1),
      );

      expect(result.recipientPhone).toBe('+201001234567');
    });

    it('hides an ACCEPTED trip from a driver who is not assigned', async () => {
      tripRepository.findOneBy.mockResolvedValue({
        ...trip,
        status: TripStatusEnum.ACCEPTED,
        driverId: 2,
      } as TripEntity);

      await expect(
        service.findVisibleTrip(trip.id, user(UserRoleEnum.DRIVER, 99)),
      ).rejects.toThrow(NotFoundException);
    });

    it('hides history from a driver browsing an open trip', async () => {
      tripRepository.findOneBy.mockResolvedValue({ ...trip } as TripEntity);

      await expect(
        service.findHistoryFor(trip.id, user(UserRoleEnum.DRIVER, 99)),
      ).rejects.toThrow(NotFoundException);
    });

    it.each([
      [UserRoleEnum.CUSTOMER, { customerId: 5 }],
      [UserRoleEnum.DRIVER, { driverId: 5 }],
    ])('lists a %s their own trips', async (role, where) => {
      await service.listMine(user(role, 5), {
        page: 2,
        limit: 10,
        status: TripStatusEnum.COMPLETED,
      });

      expect(tripRepository.findAndCount).toHaveBeenCalledWith({
        where: { ...where, status: TripStatusEnum.COMPLETED },
        order: { createdAt: 'DESC', id: 'DESC' },
        skip: 10,
        take: 10,
      });
    });

    it('lists only open, unexpired trips', async () => {
      await service.listOpen({ page: 1, limit: 20 });

      const [{ where }] = tripRepository.findAndCount.mock.calls[0] as [
        { where: { status: TripStatusEnum; expiresAt: unknown } },
      ];

      expect(where.status).toBe(TripStatusEnum.REQUESTED);
      expect(where.expiresAt).toBeDefined();
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
