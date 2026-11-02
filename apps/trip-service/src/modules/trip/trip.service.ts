import { InjectQueue } from '@nestjs/bullmq';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  MoreThan,
  Repository,
} from 'typeorm';

import { AuthenticatedUser, UserRoleEnum } from '@masr3/libs/auth';
import { isUniqueViolation } from '@masr3/libs/database';
import { dayjs } from '@masr3/libs/date';
import {
  AuditActionEnum,
  AuditActor,
  AuditActorTypeEnum,
  AuditEntityTypeEnum,
  buildAuditChanges,
  EventPayload,
  SYSTEM_AUDIT_ACTOR,
  TripKafkaTopic,
  TripActorEnum,
  TripStatusChangedEvent,
  TripStatusEnum,
  TripTypeEnum,
} from '@masr3/libs/kafka';
import { OutboxService } from '@masr3/libs/outbox';
import { paginate, Paginated, paginationWindow } from '@masr3/libs/pagination';

import { OutboxEventMap } from '../../kafka/kafka.interface';
import AuditRecorderService from '../audit/audit-recorder.service';
import TripOfferEntity from '../trip-offer/entities/trip-offer.entity';
import { TripOfferStatusEnum } from '../trip-offer/trip-offer.enum';
import UserService from '../user/user.service';
import CreateTripDto from './dto/create-trip.dto';
import ListTripsQueryDto from './dto/list-trips-query.dto';
import UpdateRequestedVehicleTypeDto from './dto/update-requested-vehicle-type.dto';
import TripStatusHistoryEntity from './entities/trip-status-history.entity';
import TripEntity from './entities/trip.entity';
import {
  ROLE_TO_TRIP_ACTOR,
  TRIP_ACTOR_TO_ROLE,
  TRIP_AUDITED_FIELDS,
  TRIP_CURRENCY,
  TRIP_EXPIRY_QUEUE,
  UQ_TRIPS_ACTIVE_CUSTOMER,
  UQ_TRIPS_ACTIVE_DRIVER,
} from './trip.constant';
import { TripExpiryJobEnum, TripListScopeEnum } from './trip.enum';
import { ExpireTripJobData, TransitionTripCommand } from './trip.interface';
import {
  actsForAnotherUser,
  assertRequestedVehicleTypeChangeAllowed,
  assertTransitionAllowed,
  canViewTrip,
  isTripParticipant,
  resolveTargetUserId,
} from './trip.policy';

@Injectable()
class TripService {
  private readonly logger = new Logger(TripService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly outboxService: OutboxService<OutboxEventMap>,
    private readonly auditRecorder: AuditRecorderService,
    private readonly userService: UserService,
    @InjectRepository(TripEntity)
    private readonly tripRepository: Repository<TripEntity>,
    @InjectRepository(TripStatusHistoryEntity)
    private readonly historyRepository: Repository<TripStatusHistoryEntity>,
    @InjectQueue(TRIP_EXPIRY_QUEUE) private readonly expiryQueue: Queue,
  ) {}

  async create(
    dto: CreateTripDto,
    user: AuthenticatedUser,
  ): Promise<TripEntity> {
    const customerId = resolveTargetUserId(user, dto.customerId, 'customerId');
    const actor = ROLE_TO_TRIP_ACTOR[user.role];

    // Only a customer named by an admin is checked against the users copy:
    // booking must not wait for the copy to catch up with a new account.
    if (actsForAnotherUser(user)) {
      await this.userService.findActiveOrFail(
        customerId,
        UserRoleEnum.CUSTOMER,
      );
    }

    const ttlMs = this.configService.getOrThrow<number>('TRIP_REQUEST_TTL_MS');
    // Parcel details mean nothing on a ride; drop them rather than store them.
    const parcel =
      dto.type === TripTypeEnum.PARCEL
        ? {}
        : {
            recipientName: null,
            recipientPhone: null,
            packageDescription: null,
          };

    let trip: TripEntity;

    try {
      trip = await this.dataSource.transaction(async (manager) => {
        const created = await manager.save(
          manager.create(TripEntity, {
            ...dto,
            ...parcel,
            customerId,
            status: TripStatusEnum.REQUESTED,
            expiresAt: dayjs().add(ttlMs, 'millisecond').toDate(),
          }),
        );

        await manager.insert(TripStatusHistoryEntity, {
          tripId: created.id,
          fromStatus: null,
          toStatus: TripStatusEnum.REQUESTED,
          actor,
          actorId: user.id,
          reason: null,
        });

        await this.outboxService.enqueue(
          manager,
          TripKafkaTopic.STATUS_CHANGED,
          TripService.buildStatusChangedEvent(
            created,
            null,
            actor,
            user.id,
            null,
          ),
          String(created.id),
        );

        await this.auditRecorder.record(manager, {
          action: AuditActionEnum.CREATED,
          entity: { type: AuditEntityTypeEnum.TRIP, id: created.id },
          actor: TripService.auditActorFor(actor, user.id),
          changes: buildAuditChanges(null, created, TRIP_AUDITED_FIELDS),
          metadata: null,
        });

        return created;
      });
    } catch (error) {
      if (isUniqueViolation(error, UQ_TRIPS_ACTIVE_CUSTOMER)) {
        throw new ConflictException('The customer already has an active trip');
      }

      throw error;
    }

    // Queued after the commit, so a job never names a rolled-back trip. Not
    // awaited: while Redis is down the request still succeeds, and the SWEEP job
    // expires the trip instead.
    const data: ExpireTripJobData = { tripId: trip.id };

    this.expiryQueue
      .add(TripExpiryJobEnum.EXPIRE_TRIP, data, {
        jobId: `trip-${trip.id}`,
        delay: Math.max(0, dayjs(trip.expiresAt).diff(dayjs())),
      })
      .catch((error: Error) =>
        this.logger.warn(
          `Could not queue expiry for trip ${trip.id}: ${error.message}`,
        ),
      );

    return trip;
  }

  async list(
    query: ListTripsQueryDto,
    user: AuthenticatedUser,
    scope: TripListScopeEnum,
  ): Promise<Paginated<TripEntity>> {
    const [items, total] = await this.tripRepository.findAndCount({
      where: TripService.prepareListWhere(query, user, scope),
      order: { createdAt: 'DESC', id: 'DESC' },
      ...paginationWindow(query),
    });

    return paginate(items, total, query);
  }

  async findVisibleTrip(
    tripId: number,
    user: AuthenticatedUser,
  ): Promise<TripEntity> {
    const trip = await this.tripRepository.findOneBy({ id: tripId });

    if (!trip || !canViewTrip(trip, user)) {
      throw new NotFoundException(`Trip ${tripId} not found`);
    }

    // A driver browsing an open trip must not see the recipient's contact.
    return isTripParticipant(trip, user)
      ? trip
      : { ...trip, recipientName: null, recipientPhone: null };
  }

  async findHistoryFor(
    tripId: number,
    user: AuthenticatedUser,
  ): Promise<TripStatusHistoryEntity[]> {
    const trip = await this.tripRepository.findOneBy({ id: tripId });

    if (!trip || !isTripParticipant(trip, user)) {
      throw new NotFoundException(`Trip ${tripId} not found`);
    }

    return this.historyRepository.find({
      where: { tripId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }

  async updateRequestedVehicleType(
    tripId: number,
    dto: UpdateRequestedVehicleTypeDto,
    user: AuthenticatedUser,
  ): Promise<TripEntity> {
    return this.dataSource.transaction(async (manager) => {
      const trip = await manager.findOne(TripEntity, {
        where: { id: tripId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!trip || !isTripParticipant(trip, user)) {
        throw new NotFoundException(`Trip ${tripId} not found`);
      }

      const hasPendingOffers = await manager.exists(TripOfferEntity, {
        where: { tripId, status: TripOfferStatusEnum.PENDING },
      });

      assertRequestedVehicleTypeChangeAllowed(trip, hasPendingOffers);

      if (trip.requestedVehicleType === dto.requestedVehicleType) {
        return trip;
      }

      await manager.update(
        TripEntity,
        { id: tripId },
        { requestedVehicleType: dto.requestedVehicleType },
      );

      const updated = await manager.findOneByOrFail(TripEntity, {
        id: tripId,
      });

      await this.auditRecorder.record(manager, {
        action: AuditActionEnum.UPDATED,
        entity: { type: AuditEntityTypeEnum.TRIP, id: tripId },
        actor: TripService.auditActorFor(
          ROLE_TO_TRIP_ACTOR[user.role],
          user.id,
        ),
        changes: buildAuditChanges(trip, updated, TRIP_AUDITED_FIELDS),
        metadata: null,
      });

      return updated;
    });
  }

  // A user's own move: the actor follows the caller's role, so an admin acts
  // for the customer or the assigned driver.
  transitionAs(
    tripId: number,
    to: TripStatusEnum,
    user: AuthenticatedUser,
    reason?: string,
  ): Promise<TripEntity> {
    return this.transition({
      tripId,
      to,
      actor: ROLE_TO_TRIP_ACTOR[user.role],
      actorId: user.id,
      reason,
    });
  }

  async transition(command: TransitionTripCommand): Promise<TripEntity> {
    try {
      return await this.dataSource.transaction((manager) =>
        this.applyTransition(manager, command),
      );
    } catch (error) {
      if (isUniqueViolation(error, UQ_TRIPS_ACTIVE_DRIVER)) {
        throw new ConflictException('The driver already has an active trip');
      }

      throw error;
    }
  }

  // Runs inside the caller's transaction (TripOfferService accepts an offer
  // through it). The row lock serialises concurrent transitions of one trip:
  // the second caller waits, then validates against the status the first one
  // wrote.
  async applyTransition(
    manager: EntityManager,
    command: TransitionTripCommand,
  ): Promise<TripEntity> {
    const {
      tripId,
      to,
      actor,
      actorId,
      reason = null,
      changes = {},
      acceptedOfferId,
    } = command;

    const trip = await manager.findOne(TripEntity, {
      where: { id: tripId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!trip) {
      throw new NotFoundException(`Trip ${tripId} not found`);
    }

    assertTransitionAllowed(trip, to, actor, actorId);

    // The expiry loop runs every few seconds; until it reaches this trip,
    // nobody may accept a request that is already past its deadline.
    if (
      to === TripStatusEnum.ACCEPTED &&
      !dayjs(trip.expiresAt).isAfter(dayjs())
    ) {
      throw new ConflictException('The trip request has expired');
    }

    if (
      to === TripStatusEnum.EXPIRED &&
      dayjs(trip.expiresAt).isAfter(dayjs())
    ) {
      throw new ConflictException('The trip request has not expired yet');
    }

    await manager.update(
      TripEntity,
      { id: tripId },
      { ...changes, status: to },
    );

    // No PENDING offer may outlive its trip's REQUESTED status. If the offer
    // being accepted was withdrawn meanwhile, the whole transition rolls back.
    if (trip.status === TripStatusEnum.REQUESTED) {
      if (acceptedOfferId !== undefined) {
        const { affected } = await manager.update(
          TripOfferEntity,
          { id: acceptedOfferId, tripId, status: TripOfferStatusEnum.PENDING },
          { status: TripOfferStatusEnum.ACCEPTED },
        );

        if (!affected) {
          throw new ConflictException('The offer is no longer pending');
        }
      }

      await manager.update(
        TripOfferEntity,
        { tripId, status: TripOfferStatusEnum.PENDING },
        {
          status:
            to === TripStatusEnum.EXPIRED
              ? TripOfferStatusEnum.EXPIRED
              : TripOfferStatusEnum.REJECTED,
        },
      );
    }

    await manager.insert(TripStatusHistoryEntity, {
      tripId,
      fromStatus: trip.status,
      toStatus: to,
      actor,
      actorId,
      reason,
    });

    const updated = await manager.findOneByOrFail(TripEntity, { id: tripId });

    await this.outboxService.enqueue(
      manager,
      TripKafkaTopic.STATUS_CHANGED,
      TripService.buildStatusChangedEvent(
        updated,
        trip.status,
        actor,
        actorId,
        reason,
      ),
      String(tripId),
    );

    await this.auditRecorder.record(manager, {
      action: AuditActionEnum.STATUS_CHANGED,
      entity: { type: AuditEntityTypeEnum.TRIP, id: tripId },
      actor: TripService.auditActorFor(actor, actorId),
      changes: buildAuditChanges(trip, updated, TRIP_AUDITED_FIELDS),
      metadata: { reason, acceptedOfferId: acceptedOfferId ?? null },
    });

    return updated;
  }

  private static prepareListWhere(
    query: ListTripsQueryDto,
    user: AuthenticatedUser,
    scope: TripListScopeEnum,
  ): FindOptionsWhere<TripEntity> {
    const where: FindOptionsWhere<TripEntity> = {};

    if (query.customerId !== undefined) {
      where.customerId = query.customerId;
    }

    if (query.driverId !== undefined) {
      where.driverId = query.driverId;
    }

    if (query.status !== undefined) {
      where.status = query.status;
    }

    if (query.type !== undefined) {
      where.type = query.type;
    }

    if (query.requestedVehicleType !== undefined) {
      where.requestedVehicleType = query.requestedVehicleType;
    }

    // MINE pins the caller's own side: a driver the trips they drive, a
    // customer the trips they asked for.
    if (scope === TripListScopeEnum.MINE) {
      if (user.role === UserRoleEnum.DRIVER) {
        where.driverId = user.id;
      } else {
        where.customerId = user.id;
      }
    }

    if (scope === TripListScopeEnum.OPEN) {
      where.status = TripStatusEnum.REQUESTED;
      where.expiresAt = MoreThan(dayjs().toDate());
    }

    return where;
  }

  // The trip actor keeps its role in the audit trail; SYSTEM (the expiry job)
  // has none.
  private static auditActorFor(
    actor: TripActorEnum,
    actorId: number | null,
  ): AuditActor {
    const role = TRIP_ACTOR_TO_ROLE[actor];

    if (!role) {
      return SYSTEM_AUDIT_ACTOR;
    }

    return { type: AuditActorTypeEnum.USER, id: actorId, role };
  }

  private static buildStatusChangedEvent(
    trip: TripEntity,
    fromStatus: TripStatusEnum | null,
    actor: TripActorEnum,
    actorId: number | null,
    reason: string | null,
  ): EventPayload<TripStatusChangedEvent> {
    return {
      tripId: trip.id,
      type: trip.type,
      customerId: trip.customerId,
      driverId: trip.driverId ?? null,
      fromStatus,
      toStatus: trip.status,
      actor,
      actorId,
      reason,
      pickupAddress: trip.pickupAddress,
      dropoffAddress: trip.dropoffAddress,
      proposedFare: trip.proposedFare,
      requestedVehicleType: trip.requestedVehicleType,
      agreedFare: trip.agreedFare ?? null,
      currency: TRIP_CURRENCY,
    };
  }
}

export default TripService;
