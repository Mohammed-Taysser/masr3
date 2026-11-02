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

import { AuthenticatedUser, UserRoleEnum } from '@masr3/libs/auth';
import { dayjs } from '@masr3/libs/date';
import {
  AuditActionEnum,
  AuditActorTypeEnum,
  AuditEntityTypeEnum,
  SYSTEM_AUDIT_ACTOR,
  TripActorEnum,
  TripKafkaTopic,
  TripStatusEnum,
  TripTypeEnum,
} from '@masr3/libs/kafka';
import { OutboxService } from '@masr3/libs/outbox';
import { VehicleTypeEnum } from '@masr3/libs/vehicle';

import AuditRecorderService from '../../audit/audit-recorder.service';
import { OutboxEventMap } from '../../../kafka/kafka.interface';
import TripOfferEntity from '../../trip-offer/entities/trip-offer.entity';
import UserService from '../../user/user.service';
import CreateTripDto from '../dto/create-trip.dto';
import TripStatusHistoryEntity from '../entities/trip-status-history.entity';
import TripEntity from '../entities/trip.entity';
import {
  UQ_TRIPS_ACTIVE_CUSTOMER,
  UQ_TRIPS_ACTIVE_DRIVER,
} from '../trip.constant';
import { TripExpiryJobEnum, TripListScopeEnum } from '../trip.enum';
import { TripOfferStatusEnum } from '../../trip-offer/trip-offer.enum';
import TripService from '../trip.service';

const TTL_MS = 600000;

const user = (role: UserRoleEnum, id: number) =>
  ({
    id,
    role,
    email: 'x@masr3.local',
    tokenVersion: 0,
  }) as AuthenticatedUser;

const customer = user(UserRoleEnum.CUSTOMER, 1);
const admin = user(UserRoleEnum.ADMIN, 9);

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
  let outboxService: jest.Mocked<OutboxService<OutboxEventMap>>;
  let auditRecorder: jest.Mocked<AuditRecorderService>;
  let expiryQueue: jest.Mocked<Queue>;
  let userService: jest.Mocked<UserService>;

  const dto: CreateTripDto = {
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
      exists: jest.fn().mockResolvedValue(false),
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
    } as unknown as jest.Mocked<OutboxService<OutboxEventMap>>;

    auditRecorder = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditRecorderService>;

    expiryQueue = {
      add: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<Queue>;

    userService = {
      findActiveOrFail: jest.fn(),
    } as unknown as jest.Mocked<UserService>;

    service = new TripService(
      dataSource,
      configService,
      outboxService,
      auditRecorder,
      userService,
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
      const result = await service.create(dto, customer);

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(manager.create).toHaveBeenCalledWith(
        TripEntity,
        expect.objectContaining({
          ...dto,
          customerId: customer.id,
          status: TripStatusEnum.REQUESTED,
          expiresAt: expect.any(Date),
        }),
      );
      expect(manager.insert).toHaveBeenCalledWith(TripStatusHistoryEntity, {
        tripId: trip.id,
        fromStatus: null,
        toStatus: TripStatusEnum.REQUESTED,
        actor: TripActorEnum.CUSTOMER,
        actorId: customer.id,
        reason: null,
      });
      expect(result.id).toBe(trip.id);
    });

    it('enqueues a REQUESTED status-changed event in the same transaction', async () => {
      await service.create(dto, customer);

      expect(outboxService.enqueue).toHaveBeenCalledWith(
        manager,
        TripKafkaTopic.STATUS_CHANGED,
        expect.objectContaining({
          tripId: trip.id,
          type: TripTypeEnum.RIDE,
          customerId: customer.id,
          driverId: null,
          fromStatus: null,
          toStatus: TripStatusEnum.REQUESTED,
          actor: TripActorEnum.CUSTOMER,
          actorId: customer.id,
          reason: null,
          pickupAddress: dto.pickupAddress,
          dropoffAddress: dto.dropoffAddress,
          proposedFare: dto.proposedFare,
          agreedFare: null,
          currency: 'EGP',
        }),
        String(trip.id),
      );
    });

    it('records a TRIP CREATED audit by the customer in the same transaction', async () => {
      await service.create(dto, customer);

      expect(auditRecorder.record).toHaveBeenCalledWith(manager, {
        action: AuditActionEnum.CREATED,
        entity: { type: AuditEntityTypeEnum.TRIP, id: trip.id },
        actor: {
          type: AuditActorTypeEnum.USER,
          id: customer.id,
          role: UserRoleEnum.CUSTOMER,
        },
        changes: expect.objectContaining({
          status: { old: null, new: TripStatusEnum.REQUESTED },
          proposedFare: { old: null, new: dto.proposedFare },
        }),
        metadata: null,
      });
    });

    it('expires the request after TRIP_REQUEST_TTL_MS', async () => {
      const before = dayjs();

      await service.create(dto, customer);

      const { expiresAt } = manager.create.mock
        .calls[0][1] as unknown as TripEntity;
      const ttl = dayjs(expiresAt).diff(before, 'millisecond');

      expect(ttl).toBeGreaterThanOrEqual(TTL_MS);
      expect(ttl).toBeLessThan(TTL_MS + 5000);
    });

    it('queues an EXPIRE_TRIP job delayed until the deadline, after the commit', async () => {
      await service.create(dto, customer);

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

      await expect(service.create(dto, customer)).resolves.toMatchObject({
        id: trip.id,
      });
    });

    it('queues nothing when the transaction fails', async () => {
      dataSource.transaction.mockRejectedValue(
        uniqueViolation(UQ_TRIPS_ACTIVE_CUSTOMER),
      );

      await expect(service.create(dto, customer)).rejects.toThrow(
        ConflictException,
      );
      expect(expiryQueue.add).not.toHaveBeenCalled();
    });

    it('turns the active-customer index violation into a conflict', async () => {
      manager.save.mockRejectedValue(uniqueViolation(UQ_TRIPS_ACTIVE_CUSTOMER));

      await expect(service.create(dto, customer)).rejects.toThrow(
        new ConflictException('The customer already has an active trip'),
      );
    });

    it('rethrows any other unique violation', async () => {
      const error = uniqueViolation('UQ_something_else');

      manager.save.mockRejectedValue(error);

      await expect(service.create(dto, customer)).rejects.toBe(error);
    });
  });

  describe('create — by an admin', () => {
    it('books for the named customer, checked against the users copy, and records the admin as actor', async () => {
      await service.create({ ...dto, customerId: 3 }, admin);

      expect(userService.findActiveOrFail).toHaveBeenCalledWith(
        3,
        UserRoleEnum.CUSTOMER,
      );
      expect(manager.create).toHaveBeenCalledWith(
        TripEntity,
        expect.objectContaining({ customerId: 3 }),
      );
      expect(manager.insert).toHaveBeenCalledWith(
        TripStatusHistoryEntity,
        expect.objectContaining({ actor: TripActorEnum.ADMIN, actorId: 9 }),
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

    it('writes nothing when the named customer is unknown', async () => {
      userService.findActiveOrFail.mockRejectedValue(
        new NotFoundException('CUSTOMER 3 not found'),
      );

      await expect(
        service.create({ ...dto, customerId: 3 }, admin),
      ).rejects.toThrow(NotFoundException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('does not consult the users copy when a customer books for themselves', async () => {
      await service.create(dto, customer);

      expect(userService.findActiveOrFail).not.toHaveBeenCalled();
    });
  });

  describe('updateRequestedVehicleType', () => {
    const requested = {
      ...trip,
      requestedVehicleType: null,
    } as TripEntity;

    beforeEach(() => {
      manager.findOne.mockResolvedValue({ ...requested });
      manager.findOneByOrFail.mockResolvedValue({
        ...requested,
        requestedVehicleType: VehicleTypeEnum.CAR,
      } as TripEntity);
    });

    it.each([
      ['its customer', customer],
      ['an admin', admin],
    ])(
      'lets %s change it, under a row lock, and audits it',
      async (_who, caller) => {
        const result = await service.updateRequestedVehicleType(
          trip.id,
          { requestedVehicleType: VehicleTypeEnum.CAR },
          caller,
        );

        expect(manager.findOne).toHaveBeenCalledWith(TripEntity, {
          where: { id: trip.id },
          lock: { mode: 'pessimistic_write' },
        });
        expect(manager.update).toHaveBeenCalledWith(
          TripEntity,
          { id: trip.id },
          { requestedVehicleType: VehicleTypeEnum.CAR },
        );
        expect(auditRecorder.record).toHaveBeenCalledWith(
          manager,
          expect.objectContaining({
            action: AuditActionEnum.UPDATED,
            actor: expect.objectContaining({
              id: caller.id,
              role: caller.role,
            }),
            changes: expect.objectContaining({
              requestedVehicleType: { old: null, new: VehicleTypeEnum.CAR },
            }),
          }),
        );
        expect(result.requestedVehicleType).toBe(VehicleTypeEnum.CAR);
      },
    );

    it('answers 404 to another customer', async () => {
      await expect(
        service.updateRequestedVehicleType(
          trip.id,
          { requestedVehicleType: VehicleTypeEnum.CAR },
          user(UserRoleEnum.CUSTOMER, 42),
        ),
      ).rejects.toThrow(NotFoundException);
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('conflicts once a pending offer exists, checking only PENDING offers', async () => {
      manager.exists.mockResolvedValue(true);

      await expect(
        service.updateRequestedVehicleType(
          trip.id,
          { requestedVehicleType: VehicleTypeEnum.CAR },
          customer,
        ),
      ).rejects.toThrow(ConflictException);
      expect(manager.exists).toHaveBeenCalledWith(TripOfferEntity, {
        where: { tripId: trip.id, status: TripOfferStatusEnum.PENDING },
      });
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('changes and audits nothing when the type is already the requested one', async () => {
      const result = await service.updateRequestedVehicleType(
        trip.id,
        { requestedVehicleType: null },
        customer,
      );

      expect(result).toEqual(requested);
      expect(manager.update).not.toHaveBeenCalled();
      expect(auditRecorder.record).not.toHaveBeenCalled();
    });
  });

  describe('transitionAs', () => {
    it.each([
      [UserRoleEnum.DRIVER, TripActorEnum.DRIVER],
      [UserRoleEnum.ADMIN, TripActorEnum.ADMIN],
    ])('moves the trip as a %s actor', async (role, actor) => {
      const transition = jest
        .spyOn(service, 'transition')
        .mockResolvedValue(trip);

      await service.transitionAs(
        trip.id,
        TripStatusEnum.COMPLETED,
        user(role, 5),
      );

      expect(transition).toHaveBeenCalledWith({
        tripId: trip.id,
        to: TripStatusEnum.COMPLETED,
        actor,
        actorId: 5,
        reason: undefined,
      });
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
      expect(auditRecorder.record).toHaveBeenCalledWith(manager, {
        action: AuditActionEnum.STATUS_CHANGED,
        entity: { type: AuditEntityTypeEnum.TRIP, id: trip.id },
        actor: {
          type: AuditActorTypeEnum.USER,
          id: trip.customerId,
          role: UserRoleEnum.CUSTOMER,
        },
        changes: {
          status: {
            old: TripStatusEnum.REQUESTED,
            new: TripStatusEnum.ACCEPTED,
          },
          driverId: { old: null, new: 2 },
          agreedFare: { old: null, new: 90 },
        },
        metadata: { reason: null, acceptedOfferId: null },
      });
    });

    it('audits a SYSTEM expiry as a SYSTEM actor, with no id or role', async () => {
      manager.findOne.mockResolvedValue({
        ...trip,
        expiresAt: dayjs().subtract(1, 'second').toDate(),
      });
      manager.findOneByOrFail.mockResolvedValue({
        ...trip,
        status: TripStatusEnum.EXPIRED,
      } as TripEntity);

      await service.transition({
        tripId: trip.id,
        to: TripStatusEnum.EXPIRED,
        actor: TripActorEnum.SYSTEM,
        actorId: null,
      });

      expect(auditRecorder.record).toHaveBeenCalledWith(
        manager,
        expect.objectContaining({
          action: AuditActionEnum.STATUS_CHANGED,
          actor: SYSTEM_AUDIT_ACTOR,
        }),
      );
    });

    it.each([
      [TripActorEnum.DRIVER, UserRoleEnum.DRIVER],
      [TripActorEnum.ADMIN, UserRoleEnum.ADMIN],
    ])('keeps the role of a %s actor', async (actor, role) => {
      manager.findOne.mockResolvedValue({
        ...trip,
        status: TripStatusEnum.ACCEPTED,
        driverId: 2,
      });
      manager.findOneByOrFail.mockResolvedValue({
        ...trip,
        status: TripStatusEnum.CANCELLED,
        driverId: 2,
      } as TripEntity);

      await service.transition({
        tripId: trip.id,
        to: TripStatusEnum.CANCELLED,
        actor,
        actorId: actor === TripActorEnum.DRIVER ? 2 : 9,
      });

      expect(auditRecorder.record).toHaveBeenCalledWith(
        manager,
        expect.objectContaining({
          actor: {
            type: AuditActorTypeEnum.USER,
            id: actor === TripActorEnum.DRIVER ? 2 : 9,
            role,
          },
        }),
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
      expect(auditRecorder.record).not.toHaveBeenCalled();
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
      await service.create({ ...dto, recipientName: 'Mona' }, customer);

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
      await service.create(
        {
          ...dto,
          type: TripTypeEnum.PARCEL,
          recipientName: 'Mona',
          recipientPhone: '+201001234567',
        },
        customer,
      );

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
  });

  describe('list', () => {
    it.each([
      [UserRoleEnum.CUSTOMER, { customerId: 5 }],
      [UserRoleEnum.DRIVER, { driverId: 5 }],
    ])('lists a %s their own trips (MINE)', async (role, where) => {
      await service.list(
        { page: 2, limit: 10, status: TripStatusEnum.COMPLETED },
        user(role, 5),
        TripListScopeEnum.MINE,
      );

      expect(tripRepository.findAndCount).toHaveBeenCalledWith({
        where: { ...where, status: TripStatusEnum.COMPLETED },
        order: { createdAt: 'DESC', id: 'DESC' },
        skip: 10,
        take: 10,
      });
    });

    it('pins MINE to the caller even when the query names another customer', async () => {
      await service.list(
        { page: 1, limit: 20, customerId: 42 },
        user(UserRoleEnum.CUSTOMER, 5),
        TripListScopeEnum.MINE,
      );

      const [{ where }] = tripRepository.findAndCount.mock.calls[0] as [
        { where: { customerId: number } },
      ];

      expect(where.customerId).toBe(5);
    });

    it('lists every trip for an admin, filtered by the query (ALL)', async () => {
      await service.list(
        {
          page: 1,
          limit: 20,
          customerId: 3,
          driverId: 4,
          type: TripTypeEnum.PARCEL,
          requestedVehicleType: VehicleTypeEnum.VAN,
        },
        admin,
        TripListScopeEnum.ALL,
      );

      expect(tripRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            customerId: 3,
            driverId: 4,
            type: TripTypeEnum.PARCEL,
            requestedVehicleType: VehicleTypeEnum.VAN,
          },
        }),
      );
    });

    it('lists only open, unexpired trips (OPEN), whatever status is asked', async () => {
      await service.list(
        { page: 1, limit: 20, status: TripStatusEnum.COMPLETED },
        user(UserRoleEnum.DRIVER, 5),
        TripListScopeEnum.OPEN,
      );

      const [{ where }] = tripRepository.findAndCount.mock.calls[0] as [
        { where: { status: TripStatusEnum; expiresAt: unknown } },
      ];

      expect(where.status).toBe(TripStatusEnum.REQUESTED);
      expect(where.expiresAt).toBeDefined();
    });
  });

  describe('findHistoryFor', () => {
    it('returns the history oldest first', async () => {
      tripRepository.findOneBy.mockResolvedValue({ ...trip } as TripEntity);
      historyRepository.find.mockResolvedValue([]);

      await service.findHistoryFor(trip.id, customer);

      expect(historyRepository.find).toHaveBeenCalledWith({
        where: { tripId: trip.id },
        order: { createdAt: 'ASC', id: 'ASC' },
      });
    });
  });
});
