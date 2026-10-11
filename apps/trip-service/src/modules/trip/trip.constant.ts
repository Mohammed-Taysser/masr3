import { TripActorEnum, TripStatusEnum, UserRoleEnum } from '@masr3/libs';

const TRIP_CURRENCY = 'EGP';

// decimal(10, 2): up to 99,999,999.99 TRIP_CURRENCY.
const FARE_PRECISION = 10;
const FARE_SCALE = 2;
const MAX_FARE = 99999999.99;

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
const UQ_TRIP_OFFERS_PENDING_DRIVER = 'UQ_trip_offers_pending_driver';

const TRIP_EXPIRY_QUEUE = 'TRIP-EXPIRY';
const TRIP_EXPIRY_SWEEP_SCHEDULER_ID = 'TRIP-EXPIRY-SWEEP';

const ROLE_TO_TRIP_ACTOR: Readonly<Record<UserRoleEnum, TripActorEnum>> = {
  [UserRoleEnum.CUSTOMER]: TripActorEnum.CUSTOMER,
  [UserRoleEnum.DRIVER]: TripActorEnum.DRIVER,
  [UserRoleEnum.ADMIN]: TripActorEnum.ADMIN,
};

export {
  TRIP_CURRENCY,
  FARE_PRECISION,
  FARE_SCALE,
  MAX_FARE,
  TRIP_TRANSITIONS,
  CUSTOMER_ACTIVE_TRIP_STATUSES,
  DRIVER_ACTIVE_TRIP_STATUSES,
  UQ_TRIPS_ACTIVE_CUSTOMER,
  UQ_TRIPS_ACTIVE_DRIVER,
  UQ_TRIP_OFFERS_PENDING_DRIVER,
  ROLE_TO_TRIP_ACTOR,
  TRIP_EXPIRY_QUEUE,
  TRIP_EXPIRY_SWEEP_SCHEDULER_ID,
};
