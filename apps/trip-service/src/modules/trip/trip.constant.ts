import { UserRoleEnum } from '@masr3/libs/auth';
import { TripActorEnum, TripStatusEnum } from '@masr3/libs/kafka';

import type TripEntity from './entities/trip.entity';

const TRIP_CURRENCY = 'EGP';

// from → to → who may make that move.
const TRIP_TRANSITIONS: Readonly<
  Record<
    TripStatusEnum,
    Partial<Record<TripStatusEnum, readonly TripActorEnum[]>>
  >
> = {
  [TripStatusEnum.REQUESTED]: {
    [TripStatusEnum.ACCEPTED]: [TripActorEnum.CUSTOMER],
    [TripStatusEnum.EXPIRED]: [TripActorEnum.SYSTEM],
    [TripStatusEnum.CANCELLED]: [TripActorEnum.CUSTOMER, TripActorEnum.ADMIN],
  },
  [TripStatusEnum.ACCEPTED]: {
    [TripStatusEnum.DRIVER_ARRIVED]: [TripActorEnum.DRIVER],
    [TripStatusEnum.CANCELLED]: [
      TripActorEnum.CUSTOMER,
      TripActorEnum.DRIVER,
      TripActorEnum.ADMIN,
    ],
  },
  [TripStatusEnum.DRIVER_ARRIVED]: {
    [TripStatusEnum.IN_PROGRESS]: [TripActorEnum.DRIVER],
    [TripStatusEnum.CANCELLED]: [
      TripActorEnum.CUSTOMER,
      TripActorEnum.DRIVER,
      TripActorEnum.ADMIN,
    ],
  },
  [TripStatusEnum.IN_PROGRESS]: {
    [TripStatusEnum.COMPLETED]: [TripActorEnum.DRIVER],
  },
  [TripStatusEnum.COMPLETED]: {},
  [TripStatusEnum.CANCELLED]: {},
  [TripStatusEnum.EXPIRED]: {},
};

const CUSTOMER_ACTIVE_TRIP_STATUSES: readonly TripStatusEnum[] = [
  TripStatusEnum.REQUESTED,
  TripStatusEnum.ACCEPTED,
  TripStatusEnum.DRIVER_ARRIVED,
  TripStatusEnum.IN_PROGRESS,
];

const DRIVER_ACTIVE_TRIP_STATUSES: readonly TripStatusEnum[] = [
  TripStatusEnum.ACCEPTED,
  TripStatusEnum.DRIVER_ARRIVED,
  TripStatusEnum.IN_PROGRESS,
];

const UQ_TRIPS_ACTIVE_CUSTOMER = 'UQ_trips_active_customer';
const UQ_TRIPS_ACTIVE_DRIVER = 'UQ_trips_active_driver';

const TRIP_EXPIRY_QUEUE = 'trip-expiry';
const TRIP_EXPIRY_SWEEP_SCHEDULER_ID = 'trip-expiry-sweep';

const ROLE_TO_TRIP_ACTOR: Readonly<Record<UserRoleEnum, TripActorEnum>> = {
  [UserRoleEnum.CUSTOMER]: TripActorEnum.CUSTOMER,
  [UserRoleEnum.DRIVER]: TripActorEnum.DRIVER,
  [UserRoleEnum.ADMIN]: TripActorEnum.ADMIN,
};

// SYSTEM (the expiry job) has no role: it is audited as a SYSTEM actor.
const TRIP_ACTOR_TO_ROLE: Readonly<Record<TripActorEnum, UserRoleEnum | null>> =
  {
    [TripActorEnum.CUSTOMER]: UserRoleEnum.CUSTOMER,
    [TripActorEnum.DRIVER]: UserRoleEnum.DRIVER,
    [TripActorEnum.ADMIN]: UserRoleEnum.ADMIN,
    [TripActorEnum.SYSTEM]: null,
  };

// The only columns an audit diff may contain. Recipient contact details stay
// out: the audit trail is read by admins long after the delivery.
const TRIP_AUDITED_FIELDS: readonly (keyof TripEntity & string)[] = [
  'type',
  'status',
  'customerId',
  'driverId',
  'pickupAddress',
  'dropoffAddress',
  'proposedFare',
  'agreedFare',
  'expiresAt',
];

export {
  TRIP_CURRENCY,
  TRIP_TRANSITIONS,
  CUSTOMER_ACTIVE_TRIP_STATUSES,
  DRIVER_ACTIVE_TRIP_STATUSES,
  UQ_TRIPS_ACTIVE_CUSTOMER,
  UQ_TRIPS_ACTIVE_DRIVER,
  ROLE_TO_TRIP_ACTOR,
  TRIP_ACTOR_TO_ROLE,
  TRIP_AUDITED_FIELDS,
  TRIP_EXPIRY_QUEUE,
  TRIP_EXPIRY_SWEEP_SCHEDULER_ID,
};
