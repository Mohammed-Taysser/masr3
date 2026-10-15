import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';

import { AuthenticatedUser, UserRoleEnum } from '@masr3/libs/auth';

import VehicleEntity from './entities/vehicle.entity';
import {
  VEHICLE_OPERATIONAL_TRANSITIONS,
  VEHICLE_VERIFICATION_TRANSITIONS,
} from './vehicle.constant';
import {
  VehicleOperationalStatusEnum,
  VehicleVerificationStatusEnum,
} from './vehicle.enum';

type VehicleStatuses = Pick<
  VehicleEntity,
  'id' | 'verificationStatus' | 'operationalStatus'
>;

// Its driver or an admin. Callers answer a stranger with 404, so they learn
// nothing about a vehicle that is not theirs.
function canAccessVehicle(
  vehicle: Pick<VehicleEntity, 'driverId'>,
  user: AuthenticatedUser,
): boolean {
  switch (user.role) {
    case UserRoleEnum.ADMIN:
      return true;
    case UserRoleEnum.DRIVER:
      return vehicle.driverId === user.id;
    default:
      return false;
  }
}

// A driver adds vehicles for themselves; an admin names the driver.
function resolveDriverId(
  user: AuthenticatedUser,
  requestedDriverId: number | undefined,
): number {
  if (user.role === UserRoleEnum.ADMIN) {
    if (requestedDriverId === undefined) {
      throw new BadRequestException(
        'driverId is required when an admin adds a vehicle',
      );
    }

    return requestedDriverId;
  }

  if (requestedDriverId !== undefined && requestedDriverId !== user.id) {
    throw new ForbiddenException('A driver can only add their own vehicles');
  }

  return user.id;
}

function assertVerificationTransition(
  vehicle: VehicleStatuses,
  to: VehicleVerificationStatusEnum,
): void {
  const from = vehicle.verificationStatus;

  if (from === to) {
    throw new ConflictException(`Vehicle ${vehicle.id} is already ${to}`);
  }

  if (!VEHICLE_VERIFICATION_TRANSITIONS[from].includes(to)) {
    throw new ConflictException(
      `Cannot move vehicle ${vehicle.id} from ${from} to ${to}`,
    );
  }

  // An ACTIVE vehicle must stay APPROVED: deactivating it is a separate,
  // deliberate step.
  if (vehicle.operationalStatus === VehicleOperationalStatusEnum.ACTIVE) {
    throw new ConflictException(
      `Vehicle ${vehicle.id} is ACTIVE; deactivate it before changing its verification`,
    );
  }
}

function assertOperationalTransition(
  vehicle: VehicleStatuses,
  to: VehicleOperationalStatusEnum,
): void {
  const from = vehicle.operationalStatus;

  if (from === to) {
    throw new ConflictException(`Vehicle ${vehicle.id} is already ${to}`);
  }

  if (!VEHICLE_OPERATIONAL_TRANSITIONS[from].includes(to)) {
    throw new ConflictException(
      `Cannot move vehicle ${vehicle.id} from ${from} to ${to}`,
    );
  }

  const isActivatingUnapproved =
    to === VehicleOperationalStatusEnum.ACTIVE &&
    vehicle.verificationStatus !== VehicleVerificationStatusEnum.APPROVED;

  if (isActivatingUnapproved) {
    throw new ConflictException(
      `Vehicle ${vehicle.id} must be APPROVED before it can be ACTIVE`,
    );
  }
}

export {
  assertOperationalTransition,
  assertVerificationTransition,
  canAccessVehicle,
  resolveDriverId,
};
