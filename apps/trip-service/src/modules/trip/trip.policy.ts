import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { TripActorEnum, TripStatusEnum } from '@masr3/libs';

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
    throw new ConflictException(
      `Cannot move a trip from ${trip.status} to ${to}`,
    );
  }

  if (!allowedActors.includes(actor)) {
    throw new ForbiddenException(
      `${actor} cannot move a trip from ${trip.status} to ${to}`,
    );
  }
}

export { assertTransitionAllowed };
