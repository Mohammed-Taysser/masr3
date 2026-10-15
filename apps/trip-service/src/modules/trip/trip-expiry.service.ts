import { InjectQueue } from '@nestjs/bullmq';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { LessThanOrEqual, Repository } from 'typeorm';

import { dayjs } from '@masr3/libs/date';
import { TripActorEnum, TripStatusEnum } from '@masr3/libs/kafka';

import TripEntity from './entities/trip.entity';
import {
  TRIP_EXPIRY_QUEUE,
  TRIP_EXPIRY_SWEEP_SCHEDULER_ID,
} from './trip.constant';
import { TripExpiryJobEnum } from './trip.enum';
import TripService from './trip.service';

@Injectable()
class TripExpiryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TripExpiryService.name);
  private readonly sweepIntervalMs: number;
  private readonly batchSize: number;

  constructor(
    private readonly tripService: TripService,
    @InjectRepository(TripEntity)
    private readonly tripRepository: Repository<TripEntity>,
    @InjectQueue(TRIP_EXPIRY_QUEUE) private readonly expiryQueue: Queue,
    configService: ConfigService,
  ) {
    this.sweepIntervalMs = configService.getOrThrow<number>(
      'TRIP_EXPIRY_SWEEP_INTERVAL_MS',
    );
    this.batchSize = configService.getOrThrow<number>('TRIP_EXPIRY_BATCH_SIZE');
  }

  async onApplicationBootstrap() {
    await this.expiryQueue.upsertJobScheduler(
      TRIP_EXPIRY_SWEEP_SCHEDULER_ID,
      { every: this.sweepIntervalMs },
      { name: TripExpiryJobEnum.SWEEP },
    );
  }

  // Goes through TripService, which locks the row, writes history, closes
  // pending offers and enqueues the event. False when the trip already moved
  // on: accepted, cancelled, expired elsewhere, or not yet due.
  async expire(tripId: number): Promise<boolean> {
    try {
      await this.tripService.transition({
        tripId,
        to: TripStatusEnum.EXPIRED,
        actor: TripActorEnum.SYSTEM,
        actorId: null,
      });

      return true;
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        return false;
      }

      throw error;
    }
  }

  // The safety net for trips whose EXPIRE_TRIP job was never queued.
  async expireDueTrips(): Promise<number> {
    const due = await this.tripRepository.find({
      select: { id: true },
      where: {
        status: TripStatusEnum.REQUESTED,
        expiresAt: LessThanOrEqual(dayjs().toDate()),
      },
      order: { expiresAt: 'ASC' },
      take: this.batchSize,
    });

    let expired = 0;

    for (const { id } of due) {
      try {
        if (await this.expire(id)) {
          expired += 1;
        }
      } catch (error) {
        this.logger.error(
          `Expiring trip ${id} failed: ${(error as Error).message}`,
        );
      }
    }

    if (expired > 0) {
      this.logger.log(`Sweep expired ${expired} trip request(s)`);
    }

    return expired;
  }
}

export default TripExpiryService;
