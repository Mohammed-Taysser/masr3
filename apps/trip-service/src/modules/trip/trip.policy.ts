import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { AuthenticatedUser, UserRoleEnum } from '@masr3/libs/auth';
import { dayjs } from '@masr3/libs/date';
import { TripActorEnum, TripStatusEnum } from '@masr3/libs/kafka';

import TripEntity from './entities/trip.entity';
import { TRIP_TRANSITIONS } from './trip.constant';

function isOwner(
  trip: Pick<TripEntity, 'customerId' | 'driverId'>,
  actor: TripActorEnum,
  actorId: number | null,
): boolean {
  switch (actor) {
    case TripActorEnum.CUSTOMER:
      return trip.customerId === actorId;
    case TripActorEnum.DRIVER:
      return trip.driverId === actorId;
    default:
      return true;
  }
}

// Ownership is checked first and answered with 404, so a stranger learns
// nothing about a trip that is not theirs.
function assertTransitionAllowed(
  trip: Pick<TripEntity, 'id' | 'status' | 'customerId' | 'driverId'>,
  to: TripStatusEnum,
  actor: TripActorEnum,
  actorId: number | null,
): void {
  if ((actor === TripActorEnum.SYSTEM) !== (actorId === null)) {
    throw new Error(
      'A SYSTEM transition has no actorId; every other actor needs one',
    );
  }

  if (!isOwner(trip, actor, actorId)) {
    throw new NotFoundException(`Trip ${trip.id} not found`);
  }

  const allowedActors = TRIP_TRANSITIONS[trip.status][to];

  if (!allowedActors) {
    if (trip.status === to) {
      throw new ConflictException(`Trip ${trip.id} is already ${to}`);
    }

    const isFinal = Object.keys(TRIP_TRANSITIONS[trip.status]).length === 0;

    if (isFinal) {
      throw new ConflictException(
        `Trip ${trip.id} is already ${trip.status} and can no longer change`,
      );
    }

    throw new ConflictException(
      `Cannot move trip ${trip.id} from ${trip.status} to ${to}`,
    );
  }

  if (!allowedActors.includes(actor)) {
    throw new ForbiddenException(
      `${actor} cannot move a trip from ${trip.status} to ${to}`,
    );
  }
}

type TripAccess = Pick<TripEntity, 'customerId' | 'driverId' | 'status'>;

// The trip's customer, its assigned driver, or an admin.
function isTripParticipant(trip: TripAccess, user: AuthenticatedUser): boolean {
  switch (user.role) {
    case UserRoleEnum.ADMIN:
      return true;
    case UserRoleEnum.CUSTOMER:
      return trip.customerId === user.id;
    case UserRoleEnum.DRIVER:
      return trip.driverId === user.id;
    default:
      return false;
  }
}

// Participants, plus any driver while the trip is still open for offers.
function canViewTrip(trip: TripAccess, user: AuthenticatedUser): boolean {
  return (
    isTripParticipant(trip, user) ||
    (user.role === UserRoleEnum.DRIVER &&
      trip.status === TripStatusEnum.REQUESTED)
  );
}

// An admin acts for another user, named in the request; everyone else acts for
// themselves, already proven by their token.
function actsForAnotherUser(user: AuthenticatedUser): boolean {
  return user.role === UserRoleEnum.ADMIN;
}

// The user a request acts for: a customer or driver acts for themselves, an
// admin names the user in `field` (customerId or driverId).
function resolveTargetUserId(
  user: AuthenticatedUser,
  requestedUserId: number | undefined,
  field: string,
): number {
  if (actsForAnotherUser(user)) {
    if (requestedUserId === undefined) {
      throw new BadRequestException(`${field} is required for an admin`);
    }

    return requestedUserId;
  }

  if (requestedUserId !== undefined && requestedUserId !== user.id) {
    throw new ForbiddenException(`${field} can only be your own id`);
  }

  return user.id;
}

// Drivers offer on the vehicle type a trip asks for, so it is fixed once a
// pending offer exists.
function assertRequestedVehicleTypeChangeAllowed(
  trip: Pick<TripEntity, 'id' | 'status' | 'expiresAt'>,
  hasPendingOffers: boolean,
): void {
  if (
    trip.status !== TripStatusEnum.REQUESTED ||
    !dayjs(trip.expiresAt).isAfter(dayjs())
  ) {
    throw new ConflictException(
      `Trip ${trip.id} is no longer open for changes`,
    );
  }

  if (hasPendingOffers) {
    throw new ConflictException(
      `Trip ${trip.id} already has offers; its vehicle type can no longer change`,
    );
  }
}

export {
  actsForAnotherUser,
  assertRequestedVehicleTypeChangeAllowed,
  assertTransitionAllowed,
  canViewTrip,
  isTripParticipant,
  resolveTargetUserId,
};
