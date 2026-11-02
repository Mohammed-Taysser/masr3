import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

import { AuthenticatedUser, UserRoleEnum } from '@masr3/libs/auth';
import { isUniqueViolation } from '@masr3/libs/database';
import {
  AuditActionEnum,
  AuditEntityTypeEnum,
  buildAuditChanges,
  buildUserAuditActor,
  TripStatusEnum,
} from '@masr3/libs/kafka';

import AuditRecorderService from '../audit/audit-recorder.service';
import TripEntity from '../trip/entities/trip.entity';
import {
  DRIVER_ACTIVE_TRIP_STATUSES,
  ROLE_TO_TRIP_ACTOR,
  UQ_TRIPS_ACTIVE_DRIVER,
} from '../trip/trip.constant';
import { actsForAnotherUser, resolveTargetUserId } from '../trip/trip.policy';
import TripService from '../trip/trip.service';
import UserService from '../user/user.service';
import CreateTripOfferDto from './dto/create-trip-offer.dto';
import TripOfferEntity from './entities/trip-offer.entity';
import {
  TRIP_OFFER_AUDITED_FIELDS,
  UQ_TRIP_OFFERS_PENDING_DRIVER,
} from './trip-offer.constant';
import { TripOfferStatusEnum } from './trip-offer.enum';
import {
  assertOfferAllowed,
  assertOfferPending,
  canManageTripOffers,
  canWithdrawOffer,
} from './trip-offer.policy';

@Injectable()
class TripOfferService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tripService: TripService,
    private readonly auditRecorder: AuditRecorderService,
    private readonly userService: UserService,
    @InjectRepository(TripEntity)
    private readonly tripRepository: Repository<TripEntity>,
    @InjectRepository(TripOfferEntity)
    private readonly offerRepository: Repository<TripOfferEntity>,
  ) {}

  // FOR SHARE: offers on one trip don't block each other, but an acceptance
  // in progress (FOR UPDATE) makes them wait and then see the new status.
  async create(
    tripId: number,
    dto: CreateTripOfferDto,
    user: AuthenticatedUser,
  ): Promise<TripOfferEntity> {
    const driverId = resolveTargetUserId(user, dto.driverId, 'driverId');

    // Like a trip's customer, only a driver named by an admin is checked
    // against the users copy.
    if (actsForAnotherUser(user)) {
      await this.userService.findActiveOrFail(driverId, UserRoleEnum.DRIVER);
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        const trip = await manager.findOne(TripEntity, {
          where: { id: tripId },
          lock: { mode: 'pessimistic_read' },
        });

        if (!trip) {
          throw new NotFoundException(`Trip ${tripId} not found`);
        }

        const isDriverBusy = await manager.exists(TripEntity, {
          where: {
            driverId,
            status: In([...DRIVER_ACTIVE_TRIP_STATUSES]),
          },
        });

        assertOfferAllowed(trip, isDriverBusy);

        const offer = await manager.save(
          manager.create(TripOfferEntity, {
            tripId,
            driverId,
            amount: dto.amount,
            status: TripOfferStatusEnum.PENDING,
          }),
        );

        await this.auditRecorder.record(manager, {
          action: AuditActionEnum.SUBMITTED,
          entity: { type: AuditEntityTypeEnum.TRIP_OFFER, id: offer.id },
          actor: buildUserAuditActor(user),
          changes: buildAuditChanges(null, offer, TRIP_OFFER_AUDITED_FIELDS),
          metadata: null,
        });

        return offer;
      });
    } catch (error) {
      if (isUniqueViolation(error, UQ_TRIP_OFFERS_PENDING_DRIVER)) {
        throw new ConflictException(
          'The driver already has a pending offer on this trip',
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

    if (!trip || !canManageTripOffers(trip, user)) {
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
    user: AuthenticatedUser,
  ): Promise<TripEntity> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const offer = await manager.findOne(TripOfferEntity, {
          where: { id: offerId, tripId },
          relations: { trip: true },
        });

        // Access is checked before the status, so a stranger gets 404
        // whatever state the offer is in.
        if (!offer || !canManageTripOffers(offer.trip, user)) {
          throw new NotFoundException(`Offer ${offerId} not found`);
        }

        assertOfferPending(offer);

        return this.tripService.applyTransition(manager, {
          tripId,
          to: TripStatusEnum.ACCEPTED,
          actor: ROLE_TO_TRIP_ACTOR[user.role],
          actorId: user.id,
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
    user: AuthenticatedUser,
  ): Promise<TripOfferEntity> {
    return this.dataSource.transaction(async (manager) => {
      const offer = await manager.findOne(TripOfferEntity, {
        where: { id: offerId, tripId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!offer || !canWithdrawOffer(offer, user)) {
        throw new NotFoundException(`Offer ${offerId} not found`);
      }

      assertOfferPending(offer);

      await manager.update(
        TripOfferEntity,
        { id: offerId },
        { status: TripOfferStatusEnum.WITHDRAWN },
      );

      const withdrawn = await manager.findOneByOrFail(TripOfferEntity, {
        id: offerId,
      });

      await this.auditRecorder.record(manager, {
        action: AuditActionEnum.WITHDRAWN,
        entity: { type: AuditEntityTypeEnum.TRIP_OFFER, id: offerId },
        actor: buildUserAuditActor(user),
        changes: buildAuditChanges(offer, withdrawn, TRIP_OFFER_AUDITED_FIELDS),
        metadata: null,
      });

      return withdrawn;
    });
  }
}

export default TripOfferService;
