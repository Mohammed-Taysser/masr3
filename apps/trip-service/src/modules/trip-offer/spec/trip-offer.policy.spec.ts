import { ConflictException } from '@nestjs/common';

import { AuthenticatedUser, UserRoleEnum } from '@masr3/libs/auth';
import { dayjs } from '@masr3/libs/date';
import { TripStatusEnum } from '@masr3/libs/kafka';

import { TripOfferStatusEnum } from '../trip-offer.enum';
import {
  assertOfferAllowed,
  assertOfferPending,
  canManageTripOffers,
  canWithdrawOffer,
} from '../trip-offer.policy';

const user = (role: UserRoleEnum, id: number) =>
  ({ id, role, email: 'x@masr3.local', tokenVersion: 0 }) as AuthenticatedUser;

describe('canManageTripOffers', () => {
  const trip = { customerId: 1 };

  it.each([
    ['its customer', user(UserRoleEnum.CUSTOMER, 1), true],
    ['an admin', user(UserRoleEnum.ADMIN, 9), true],
    ['another customer', user(UserRoleEnum.CUSTOMER, 2), false],
    ['a driver', user(UserRoleEnum.DRIVER, 1), false],
  ])('is %s → %s', (_who, caller, expected) => {
    expect(canManageTripOffers(trip, caller)).toBe(expected);
  });
});

describe('canWithdrawOffer', () => {
  const offer = { driverId: 5 };

  it.each([
    ['the offering driver', user(UserRoleEnum.DRIVER, 5), true],
    ['an admin', user(UserRoleEnum.ADMIN, 9), true],
    ['another driver', user(UserRoleEnum.DRIVER, 6), false],
    ['a customer', user(UserRoleEnum.CUSTOMER, 5), false],
  ])('is %s → %s', (_who, caller, expected) => {
    expect(canWithdrawOffer(offer, caller)).toBe(expected);
  });
});

describe('assertOfferAllowed', () => {
  const open = {
    status: TripStatusEnum.REQUESTED,
    expiresAt: dayjs().add(5, 'minute').toDate(),
  };

  it('allows an open trip and a free driver', () => {
    expect(() => assertOfferAllowed(open, false)).not.toThrow();
  });

  it.each([
    [
      'the trip is no longer REQUESTED',
      { ...open, status: TripStatusEnum.ACCEPTED },
      false,
      'The trip is no longer open for offers',
    ],
    [
      'the request has expired',
      { ...open, expiresAt: dayjs().subtract(1, 'second').toDate() },
      false,
      'The trip request has expired',
    ],
    ['the driver is busy', open, true, 'The driver already has an active trip'],
  ])('conflicts when %s', (_case, trip, isDriverBusy, message) => {
    expect(() => assertOfferAllowed(trip, isDriverBusy)).toThrow(
      new ConflictException(message),
    );
  });
});

describe('assertOfferPending', () => {
  it('allows a PENDING offer', () => {
    expect(() =>
      assertOfferPending({ status: TripOfferStatusEnum.PENDING }),
    ).not.toThrow();
  });

  it.each([
    TripOfferStatusEnum.ACCEPTED,
    TripOfferStatusEnum.REJECTED,
    TripOfferStatusEnum.WITHDRAWN,
    TripOfferStatusEnum.EXPIRED,
  ])('conflicts on a %s offer', (status) => {
    expect(() => assertOfferPending({ status })).toThrow(ConflictException);
  });
});
