import { ConflictException } from '@nestjs/common';

import { AuthenticatedUser, UserRoleEnum } from '@masr3/libs/auth';
import { dayjs } from '@masr3/libs/date';
import { TripStatusEnum } from '@masr3/libs/kafka';

import TripEntity from '../trip/entities/trip.entity';
import TripOfferEntity from './entities/trip-offer.entity';
import { TripOfferStatusEnum } from './trip-offer.enum';

// The trip's customer, or an admin for them: who sees a trip's offers and
// accepts one. Callers answer anyone else with 404.
function canManageTripOffers(
  trip: Pick<TripEntity, 'customerId'>,
  user: AuthenticatedUser,
): boolean {
  switch (user.role) {
    case UserRoleEnum.ADMIN:
      return true;
    case UserRoleEnum.CUSTOMER:
      return trip.customerId === user.id;
    default:
      return false;
  }
}

// The offering driver, or an admin for them.
function canWithdrawOffer(
  offer: Pick<TripOfferEntity, 'driverId'>,
  user: AuthenticatedUser,
): boolean {
  switch (user.role) {
    case UserRoleEnum.ADMIN:
      return true;
    case UserRoleEnum.DRIVER:
      return offer.driverId === user.id;
    default:
      return false;
  }
}

function assertOfferAllowed(
  trip: Pick<TripEntity, 'status' | 'expiresAt'>,
  isDriverBusy: boolean,
): void {
  if (trip.status !== TripStatusEnum.REQUESTED) {
    throw new ConflictException('The trip is no longer open for offers');
  }

  if (!dayjs(trip.expiresAt).isAfter(dayjs())) {
    throw new ConflictException('The trip request has expired');
  }

  if (isDriverBusy) {
    throw new ConflictException('The driver already has an active trip');
  }
}

// Only a PENDING offer can be accepted or withdrawn.
function assertOfferPending(offer: Pick<TripOfferEntity, 'status'>): void {
  if (offer.status !== TripOfferStatusEnum.PENDING) {
    throw new ConflictException('The offer is no longer pending');
  }
}

export {
  assertOfferAllowed,
  assertOfferPending,
  canManageTripOffers,
  canWithdrawOffer,
};
