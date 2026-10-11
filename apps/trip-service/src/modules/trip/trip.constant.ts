import { TripActorEnum, TripStatusEnum } from '@masr3/libs';

const TRIP_CURRENCY = 'EGP';

// decimal(10, 2): up to 99,999,999.99 TRIP_CURRENCY.
const FARE_PRECISION = 10;
const FARE_SCALE = 2;

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

const PG_UNIQUE_VIOLATION = '23505';

export {
  TRIP_CURRENCY,
  FARE_PRECISION,
  FARE_SCALE,
  TRIP_TRANSITIONS,
  CUSTOMER_ACTIVE_TRIP_STATUSES,
  DRIVER_ACTIVE_TRIP_STATUSES,
  UQ_TRIPS_ACTIVE_CUSTOMER,
  UQ_TRIPS_ACTIVE_DRIVER,
  PG_UNIQUE_VIOLATION,
};
