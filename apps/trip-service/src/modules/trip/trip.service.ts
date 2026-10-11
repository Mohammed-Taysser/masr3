import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';

import { dayjs } from '@masr3/libs';

import TripStatusHistoryEntity from './entities/trip-status-history.entity';
import TripEntity from './entities/trip.entity';
import {
  PG_UNIQUE_VIOLATION,
  UQ_TRIPS_ACTIVE_CUSTOMER,
  UQ_TRIPS_ACTIVE_DRIVER,
} from './trip.constant';
import { TripActorEnum, TripStatusEnum } from './trip.enum';
import { CreateTripCommand, TransitionTripCommand } from './trip.interface';
import { assertTransitionAllowed } from './trip.policy';

@Injectable()
class TripService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    @InjectRepository(TripStatusHistoryEntity)
    private readonly historyRepository: Repository<TripStatusHistoryEntity>,
  ) {}

  async create(command: CreateTripCommand): Promise<TripEntity> {
    const ttlMs = this.configService.getOrThrow<number>('TRIP_REQUEST_TTL_MS');

    try {
      return await this.dataSource.transaction(async (manager) => {
        const trip = await manager.save(
          manager.create(TripEntity, {
            ...command,
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

        return trip;
      });
    } catch (error) {
      if (TripService.isUniqueViolation(error, UQ_TRIPS_ACTIVE_CUSTOMER)) {
        throw new ConflictException('The customer already has an active trip');
      }

      throw error;
    }
  }

  // The row lock serialises concurrent transitions of one trip: the second
  // caller waits, then validates against the status the first one wrote.
  async transition(command: TransitionTripCommand): Promise<TripEntity> {
    const { tripId, to, actor, actorId, reason = null, changes = {} } = command;

    try {
      return await this.dataSource.transaction(async (manager) => {
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

        await manager.insert(TripStatusHistoryEntity, {
          tripId,
          fromStatus: trip.status,
          toStatus: to,
          actor,
          actorId,
          reason,
        });

        return manager.findOneByOrFail(TripEntity, { id: tripId });
      });
    } catch (error) {
      if (TripService.isUniqueViolation(error, UQ_TRIPS_ACTIVE_DRIVER)) {
        throw new ConflictException('The driver already has an active trip');
      }

      throw error;
    }
  }

  findHistory(tripId: number): Promise<TripStatusHistoryEntity[]> {
    return this.historyRepository.find({
      where: { tripId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }

  private static isUniqueViolation(error: unknown, index: string): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const { code, constraint } = error.driverError as {
      code?: string;
      constraint?: string;
    };

    return code === PG_UNIQUE_VIOLATION && constraint === index;
  }
}

export default TripService;
