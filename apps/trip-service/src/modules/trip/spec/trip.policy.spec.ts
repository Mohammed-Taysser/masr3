import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { TripActorEnum, TripStatusEnum } from '@masr3/libs';

import { TRIP_TRANSITIONS } from '../trip.constant';
import { assertTransitionAllowed } from '../trip.policy';

const CUSTOMER_ID = 1;
const DRIVER_ID = 2;
const ADMIN_ID = 9;

const actorIds: Record<TripActorEnum, number | null> = {
  [TripActorEnum.CUSTOMER]: CUSTOMER_ID,
  [TripActorEnum.DRIVER]: DRIVER_ID,
  [TripActorEnum.ADMIN]: ADMIN_ID,
  [TripActorEnum.SYSTEM]: null,
};

const tripIn = (status: TripStatusEnum) => ({
  id: 7,
  status,
  customerId: CUSTOMER_ID,
  driverId: DRIVER_ID,
});

const statuses = Object.values(TripStatusEnum);
const actors = Object.values(TripActorEnum);

const cases = statuses.flatMap((from) =>
  statuses.flatMap((to) => actors.map((actor) => ({ from, to, actor }))),
);

describe('assertTransitionAllowed', () => {
  describe.each(cases)('$from → $to by $actor', (move) => {
    const allowedActors = TRIP_TRANSITIONS[move.from][move.to];

    const run = () =>
      assertTransitionAllowed(
        tripIn(move.from),
        move.to,
        move.actor,
        actorIds[move.actor],
      );

    if (!allowedActors) {
      it('is a conflict', () => {
        expect(run).toThrow(ConflictException);
      });
    } else if (allowedActors.includes(move.actor)) {
      it('is allowed', () => {
        expect(run).not.toThrow();
      });
    } else {
      it('is forbidden', () => {
        expect(run).toThrow(ForbiddenException);
      });
    }
  });

  it.each([
    TripStatusEnum.COMPLETED,
    TripStatusEnum.CANCELLED,
    TripStatusEnum.EXPIRED,
  ])('treats %s as terminal', (status) => {
    expect(TRIP_TRANSITIONS[status]).toEqual({});
  });

  it.each([
    [
      TripStatusEnum.IN_PROGRESS,
      TripStatusEnum.IN_PROGRESS,
      TripActorEnum.DRIVER,
      'Trip 7 is already IN_PROGRESS',
    ],
    [
      TripStatusEnum.CANCELLED,
      TripStatusEnum.CANCELLED,
      TripActorEnum.CUSTOMER,
      'Trip 7 is already CANCELLED',
    ],
    [
      TripStatusEnum.COMPLETED,
      TripStatusEnum.CANCELLED,
      TripActorEnum.CUSTOMER,
      'Trip 7 is already COMPLETED and can no longer change',
    ],
    [
      TripStatusEnum.ACCEPTED,
      TripStatusEnum.IN_PROGRESS,
      TripActorEnum.DRIVER,
      'Cannot move trip 7 from ACCEPTED to IN_PROGRESS',
    ],
  ])('explains %s → %s by %s', (from, to, actor, message) => {
    expect(() =>
      assertTransitionAllowed(tripIn(from), to, actor, actorIds[actor]),
    ).toThrow(new ConflictException(message));
  });

  it('hides another customer’s trip as not found', () => {
    expect(() =>
      assertTransitionAllowed(
        tripIn(TripStatusEnum.REQUESTED),
        TripStatusEnum.CANCELLED,
        TripActorEnum.CUSTOMER,
        CUSTOMER_ID + 100,
      ),
    ).toThrow(NotFoundException);
  });

  it('hides a trip from a driver who is not assigned', () => {
    expect(() =>
      assertTransitionAllowed(
        tripIn(TripStatusEnum.ACCEPTED),
        TripStatusEnum.DRIVER_ARRIVED,
        TripActorEnum.DRIVER,
        DRIVER_ID + 100,
      ),
    ).toThrow(NotFoundException);
  });

  it('checks ownership before the status edge', () => {
    expect(() =>
      assertTransitionAllowed(
        tripIn(TripStatusEnum.COMPLETED),
        TripStatusEnum.CANCELLED,
        TripActorEnum.CUSTOMER,
        CUSTOMER_ID + 100,
      ),
    ).toThrow(NotFoundException);
  });

  it.each([
    [TripActorEnum.SYSTEM, 5],
    [TripActorEnum.ADMIN, null],
    [TripActorEnum.CUSTOMER, null],
  ])('rejects %s with actorId %p', (actor, actorId) => {
    expect(() =>
      assertTransitionAllowed(
        tripIn(TripStatusEnum.REQUESTED),
        TripStatusEnum.CANCELLED,
        actor,
        actorId,
      ),
    ).toThrow(/SYSTEM transition has no actorId/);
  });
});
