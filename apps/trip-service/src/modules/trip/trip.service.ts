import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  MoreThan,
  Repository,
} from 'typeorm';

import {
  AuthenticatedUser,
  dayjs,
  TripActorEnum,
  TripKafkaTopic,
  TripStatusChangedEvent,
  TripStatusEnum,
  TripTypeEnum,
  UserRoleEnum,
} from '@masr3/libs';

import { isUniqueViolation } from '../../shared/database/postgres-error';
import { Paginated } from '../../shared/pagination/pagination.interface';
import { paginate } from '../../shared/pagination/pagination';
import OutboxService from '../outbox/outbox.service';
import ListTripsQueryDto from './dto/list-trips-query.dto';
import TripOfferEntity from './entities/trip-offer.entity';
import TripStatusHistoryEntity from './entities/trip-status-history.entity';
import TripEntity from './entities/trip.entity';
import {
  UQ_TRIPS_ACTIVE_CUSTOMER,
  UQ_TRIPS_ACTIVE_DRIVER,
} from './trip.constant';
import { TripOfferStatusEnum } from './trip.enum';
import { CreateTripCommand, TransitionTripCommand } from './trip.interface';
import {
  assertTransitionAllowed,
  canViewTrip,
  isTripParticipant,
} from './trip.policy';

@Injectable()
class TripService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly outboxService: OutboxService,
    @InjectRepository(TripEntity)
    private readonly tripRepository: Repository<TripEntity>,
    @InjectRepository(TripStatusHistoryEntity)
    private readonly historyRepository: Repository<TripStatusHistoryEntity>,
  ) {}

  async create(command: CreateTripCommand): Promise<TripEntity> {
    const ttlMs = this.configService.getOrThrow<number>('TRIP_REQUEST_TTL_MS');
    // Parcel details mean nothing on a ride; drop them rather than store them.
    const parcel =
      command.type === TripTypeEnum.PARCEL
        ? {}
        : {
            recipientName: null,
            recipientPhone: null,
            packageDescription: null,
          };

    try {
      return await this.dataSource.transaction(async (manager) => {
        const trip = await manager.save(
          manager.create(TripEntity, {
            ...command,
            ...parcel,
            status: TripStatusEnum.REQUESTED,
            expiresAt: dayjs().add(ttlMs, 'millisecond').toDate(),
          }),
        );

        await manager.insert(TripStatusHistoryEntity, {
          tripId: trip.id,
          fromStatus: null,
          toStatus: TripStatusEnum.REQUESTED,
          actor: TripActorEnum.CUSTOMER,
          actorId: command.customerId,
          reason: null,
        });

        await this.outboxService.enqueue(
          manager,
          TripKafkaTopic.STATUS_CHANGED,
          TripService.buildStatusChangedEvent(
            trip,
            null,
            TripActorEnum.CUSTOMER,
            command.customerId,
            null,
          ),
          String(trip.id),
        );

        return trip;
      });
    } catch (error) {
      if (isUniqueViolation(error, UQ_TRIPS_ACTIVE_CUSTOMER)) {
        throw new ConflictException('The customer already has an active trip');
      }

      throw error;
    }
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

  // Runs inside the caller's transaction. The row lock serialises concurrent
  // transitions of one trip: the second caller waits, then validates against
  // the status the first one wrote.
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

    await manager.update(
      TripEntity,
      { id: tripId },
      { ...changes, status: to },
    );

    if (trip.status === TripStatusEnum.REQUESTED) {
      await TripService.closePendingOffers(
        manager,
        tripId,
        to,
        acceptedOfferId,
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

    return updated;
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

    return this.findHistory(tripId);
  }

  findHistory(tripId: number): Promise<TripStatusHistoryEntity[]> {
    return this.historyRepository.find({
      where: { tripId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }

  async listMine(
    user: AuthenticatedUser,
    query: ListTripsQueryDto,
  ): Promise<Paginated<TripEntity>> {
    const where: FindOptionsWhere<TripEntity> =
      user.role === UserRoleEnum.DRIVER
        ? { driverId: user.id }
        : { customerId: user.id };

    if (query.status) {
      where.status = query.status;
    }

    return this.list(where, query);
  }

  listOpen(query: ListTripsQueryDto): Promise<Paginated<TripEntity>> {
    return this.list(
      {
        status: TripStatusEnum.REQUESTED,
        expiresAt: MoreThan(dayjs().toDate()),
      },
      query,
    );
  }

  private async list(
    where: FindOptionsWhere<TripEntity>,
    { page, limit }: ListTripsQueryDto,
  ): Promise<Paginated<TripEntity>> {
    const [items, total] = await this.tripRepository.findAndCount({
      where,
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return paginate(items, total, page, limit);
  }

  // No PENDING offer may outlive its trip's REQUESTED status. If the offer
  // being accepted was withdrawn meanwhile, the whole transition rolls back.
  private static async closePendingOffers(
    manager: EntityManager,
    tripId: number,
    to: TripStatusEnum,
    acceptedOfferId: number | undefined,
  ): Promise<void> {
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

  private static buildStatusChangedEvent(
    trip: TripEntity,
    fromStatus: TripStatusEnum | null,
    actor: TripActorEnum,
    actorId: number | null,
    reason: string | null,
  ): TripStatusChangedEvent {
    return {
      eventId: randomUUID(),
      occurredAt: dayjs().toISOString(),
      tripId: trip.id,
      type: trip.type,
      customerId: trip.customerId,
      driverId: trip.driverId ?? null,
      fromStatus,
      toStatus: trip.status,
      actor,
      actorId,
      reason,
      proposedFare: trip.proposedFare,
      agreedFare: trip.agreedFare ?? null,
    };
  }
}

export default TripService;
