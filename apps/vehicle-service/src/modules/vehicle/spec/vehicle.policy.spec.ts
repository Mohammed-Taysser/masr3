import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';

import { AuthenticatedUser, UserRoleEnum } from '@masr3/libs/auth';

import {
  VehicleOperationalStatusEnum,
  VehicleVerificationStatusEnum,
} from '../vehicle.enum';
import {
  assertOperationalTransition,
  assertVerificationTransition,
  canAccessVehicle,
  resolveDriverId,
} from '../vehicle.policy';

const user = (role: UserRoleEnum, id = 5): AuthenticatedUser => ({
  id,
  email: 'someone@masr3.local',
  role,
  tokenVersion: 0,
});

const vehicle = (
  verificationStatus: VehicleVerificationStatusEnum,
  operationalStatus: VehicleOperationalStatusEnum,
) => ({ id: 12, verificationStatus, operationalStatus });

describe('canAccessVehicle', () => {
  it.each([
    [UserRoleEnum.ADMIN, 99, true],
    [UserRoleEnum.DRIVER, 5, true],
    [UserRoleEnum.DRIVER, 6, false],
    [UserRoleEnum.CUSTOMER, 5, false],
  ])('%s %p → %p', (role, id, expected) => {
    expect(canAccessVehicle({ driverId: 5 }, user(role, id))).toBe(expected);
  });
});

describe('resolveDriverId', () => {
  it('uses the driver themselves', () => {
    expect(resolveDriverId(user(UserRoleEnum.DRIVER), undefined)).toBe(5);
    expect(resolveDriverId(user(UserRoleEnum.DRIVER), 5)).toBe(5);
  });

  it("rejects a driver adding another driver's vehicle", () => {
    expect(() => resolveDriverId(user(UserRoleEnum.DRIVER), 6)).toThrow(
      ForbiddenException,
    );
  });

  it('uses the driverId an admin sends', () => {
    expect(resolveDriverId(user(UserRoleEnum.ADMIN, 1), 6)).toBe(6);
  });

  it('requires a driverId from an admin', () => {
    expect(() =>
      resolveDriverId(user(UserRoleEnum.ADMIN, 1), undefined),
    ).toThrow(BadRequestException);
  });
});

describe('assertVerificationTransition', () => {
  const { PENDING, APPROVED, REJECTED } = VehicleVerificationStatusEnum;
  const { ACTIVE, INACTIVE } = VehicleOperationalStatusEnum;

  it.each([
    [PENDING, APPROVED],
    [PENDING, REJECTED],
    [APPROVED, REJECTED],
    [REJECTED, PENDING],
  ])('allows %s → %s', (from, to) => {
    expect(() =>
      assertVerificationTransition(vehicle(from, INACTIVE), to),
    ).not.toThrow();
  });

  it.each([
    [PENDING, PENDING],
    [APPROVED, PENDING],
    [REJECTED, APPROVED],
  ])('rejects %s → %s', (from, to) => {
    expect(() =>
      assertVerificationTransition(vehicle(from, INACTIVE), to),
    ).toThrow(ConflictException);
  });

  it('rejects un-approving an ACTIVE vehicle', () => {
    expect(() =>
      assertVerificationTransition(vehicle(APPROVED, ACTIVE), REJECTED),
    ).toThrow('deactivate it before changing its verification');
  });
});

describe('assertOperationalTransition', () => {
  const { APPROVED, PENDING } = VehicleVerificationStatusEnum;
  const { ACTIVE, INACTIVE, SUSPENDED } = VehicleOperationalStatusEnum;

  it.each([
    [INACTIVE, ACTIVE],
    [INACTIVE, SUSPENDED],
    [ACTIVE, INACTIVE],
    [ACTIVE, SUSPENDED],
    [SUSPENDED, INACTIVE],
  ])('allows %s → %s on an APPROVED vehicle', (from, to) => {
    expect(() =>
      assertOperationalTransition(vehicle(APPROVED, from), to),
    ).not.toThrow();
  });

  it.each([
    [ACTIVE, ACTIVE],
    [SUSPENDED, ACTIVE],
  ])('rejects %s → %s', (from, to) => {
    expect(() =>
      assertOperationalTransition(vehicle(APPROVED, from), to),
    ).toThrow(ConflictException);
  });

  it('rejects activating a vehicle that is not APPROVED', () => {
    expect(() =>
      assertOperationalTransition(vehicle(PENDING, INACTIVE), ACTIVE),
    ).toThrow('must be APPROVED before it can be ACTIVE');
  });

  it('lets an admin suspend a vehicle that is not APPROVED', () => {
    expect(() =>
      assertOperationalTransition(vehicle(PENDING, INACTIVE), SUSPENDED),
    ).not.toThrow();
  });
});
