import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { AuthenticatedUser, UserRoleEnum } from '@masr3/libs/auth';
import { dayjs } from '@masr3/libs/date';
import { TripActorEnum, TripStatusEnum } from '@masr3/libs/kafka';

import { TRIP_TRANSITIONS } from '../trip.constant';
import {
  actsForAnotherUser,
  assertRequestedVehicleTypeChangeAllowed,
  assertTransitionAllowed,
  resolveTargetUserId,
} from '../trip.policy';

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

describe('admin moves', () => {
  it.each([
    [TripStatusEnum.REQUESTED, TripStatusEnum.ACCEPTED],
    [TripStatusEnum.ACCEPTED, TripStatusEnum.DRIVER_ARRIVED],
    [TripStatusEnum.DRIVER_ARRIVED, TripStatusEnum.IN_PROGRESS],
    [TripStatusEnum.IN_PROGRESS, TripStatusEnum.COMPLETED],
  ])('lets an admin move %s → %s for the user', (from, to) => {
    expect(() =>
      assertTransitionAllowed(tripIn(from), to, TripActorEnum.ADMIN, ADMIN_ID),
    ).not.toThrow();
  });
});

const userWith = (role: UserRoleEnum, id: number) =>
  ({ id, role, email: 'x@masr3.local', tokenVersion: 0 }) as AuthenticatedUser;

describe('actsForAnotherUser', () => {
  it.each([
    [UserRoleEnum.ADMIN, true],
    [UserRoleEnum.CUSTOMER, false],
    [UserRoleEnum.DRIVER, false],
  ])('is %s → %s', (role, expected) => {
    expect(actsForAnotherUser(userWith(role, 1))).toBe(expected);
  });
});

describe('resolveTargetUserId', () => {
  const admin = userWith(UserRoleEnum.ADMIN, 9);
  const customer = userWith(UserRoleEnum.CUSTOMER, 3);

  it('takes the id an admin names', () => {
    expect(resolveTargetUserId(admin, 3, 'customerId')).toBe(3);
  });

  it('rejects an admin who names nobody', () => {
    expect(() => resolveTargetUserId(admin, undefined, 'customerId')).toThrow(
      BadRequestException,
    );
  });

  it.each([undefined, 3])(
    'resolves a customer to themselves when they send %s',
    (requested) => {
      expect(resolveTargetUserId(customer, requested, 'customerId')).toBe(3);
    },
  );

  it('forbids a customer naming someone else', () => {
    expect(() => resolveTargetUserId(customer, 4, 'customerId')).toThrow(
      ForbiddenException,
    );
  });
});

describe('assertRequestedVehicleTypeChangeAllowed', () => {
  const open = {
    id: 7,
    status: TripStatusEnum.REQUESTED,
    expiresAt: dayjs().add(5, 'minute').toDate(),
  };

  it('allows an open trip with no pending offer', () => {
    expect(() =>
      assertRequestedVehicleTypeChangeAllowed(open, false),
    ).not.toThrow();
  });

  it.each([
    [
      'is no longer REQUESTED',
      { ...open, status: TripStatusEnum.ACCEPTED },
      false,
    ],
    [
      'has expired',
      { ...open, expiresAt: dayjs().subtract(1, 'second').toDate() },
      false,
    ],
    ['has a pending offer', open, true],
  ])('conflicts when the trip %s', (_case, trip, hasPendingOffers) => {
    expect(() =>
      assertRequestedVehicleTypeChangeAllowed(trip, hasPendingOffers),
    ).toThrow(ConflictException);
  });
});
