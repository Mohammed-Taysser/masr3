import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

import {
  AuthenticatedUser,
  dayjs,
  TripActorEnum,
  TripStatusEnum,
  UserRoleEnum,
} from '@masr3/libs';

import { isUniqueViolation } from '../../shared/database/postgres-error';
import TripOfferEntity from './entities/trip-offer.entity';
import TripEntity from './entities/trip.entity';
import {
  DRIVER_ACTIVE_TRIP_STATUSES,
  UQ_TRIP_OFFERS_PENDING_DRIVER,
  UQ_TRIPS_ACTIVE_DRIVER,
} from './trip.constant';
import { TripOfferStatusEnum } from './trip.enum';
import TripService from './trip.service';

@Injectable()
class TripOfferService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tripService: TripService,
    @InjectRepository(TripEntity)
    private readonly tripRepository: Repository<TripEntity>,
    @InjectRepository(TripOfferEntity)
    private readonly offerRepository: Repository<TripOfferEntity>,
  ) {}

  // FOR SHARE: offers on one trip don't block each other, but an acceptance
  // in progress (FOR UPDATE) makes them wait and then see the new status.
  async create(
    tripId: number,
    driver: AuthenticatedUser,
    amount: number,
  ): Promise<TripOfferEntity> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const trip = await manager.findOne(TripEntity, {
          where: { id: tripId },
          lock: { mode: 'pessimistic_read' },
        });

        if (!trip) {
          throw new NotFoundException(`Trip ${tripId} not found`);
        }

        if (trip.status !== TripStatusEnum.REQUESTED) {
          throw new ConflictException('The trip is no longer open for offers');
        }

        if (!dayjs(trip.expiresAt).isAfter(dayjs())) {
          throw new ConflictException('The trip request has expired');
        }

        const busy = await manager.exists(TripEntity, {
          where: {
            driverId: driver.id,
            status: In([...DRIVER_ACTIVE_TRIP_STATUSES]),
          },
        });

        if (busy) {
          throw new ConflictException('You already have an active trip');
        }

        return manager.save(
          manager.create(TripOfferEntity, {
            tripId,
            driverId: driver.id,
            amount,
            status: TripOfferStatusEnum.PENDING,
          }),
        );
      });
    } catch (error) {
      if (isUniqueViolation(error, UQ_TRIP_OFFERS_PENDING_DRIVER)) {
        throw new ConflictException(
          'You already have a pending offer on this trip',
        );
      }

      throw error;
    }
  }

  async listForTrip(
    tripId: number,
    user: AuthenticatedUser,
  ): Promise<TripOfferEntity[]> {
    const trip = await this.tripRepository.findOneBy({ id: tripId });

    if (
      !trip ||
      (user.role !== UserRoleEnum.ADMIN && trip.customerId !== user.id)
    ) {
      throw new NotFoundException(`Trip ${tripId} not found`);
    }

    return this.offerRepository.find({
      where: { tripId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }

  async accept(
    tripId: number,
    offerId: number,
    customer: AuthenticatedUser,
  ): Promise<TripEntity> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        // Looked up through the trip's customer, so a stranger gets 404
        // whatever state the offer is in.
        const offer = await manager.findOne(TripOfferEntity, {
          where: { id: offerId, tripId, trip: { customerId: customer.id } },
        });

        if (!offer) {
          throw new NotFoundException(`Offer ${offerId} not found`);
        }

        if (offer.status !== TripOfferStatusEnum.PENDING) {
          throw new ConflictException('The offer is no longer pending');
        }

        return this.tripService.applyTransition(manager, {
          tripId,
          to: TripStatusEnum.ACCEPTED,
          actor: TripActorEnum.CUSTOMER,
          actorId: customer.id,
          changes: { driverId: offer.driverId, agreedFare: offer.amount },
          acceptedOfferId: offer.id,
        });
      });
    } catch (error) {
      if (isUniqueViolation(error, UQ_TRIPS_ACTIVE_DRIVER)) {
        throw new ConflictException('The driver already has an active trip');
      }

      throw error;
    }
  }

  async withdraw(
    tripId: number,
    offerId: number,
    driver: AuthenticatedUser,
  ): Promise<TripOfferEntity> {
    const owned = { id: offerId, tripId, driverId: driver.id };

    const { affected } = await this.offerRepository.update(
      { ...owned, status: TripOfferStatusEnum.PENDING },
      { status: TripOfferStatusEnum.WITHDRAWN },
    );

    if (!affected) {
      const offer = await this.offerRepository.findOneBy(owned);

      if (!offer) {
        throw new NotFoundException(`Offer ${offerId} not found`);
      }

      throw new ConflictException('The offer is no longer pending');
    }

    return this.offerRepository.findOneByOrFail(owned);
  }
}

export default TripOfferService;
