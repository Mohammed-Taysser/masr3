import { TripActorEnum, TripStatusEnum } from '@masr3/libs/kafka';

import { TripCancelledByEnum } from '../notification/notification.enum';

// A trip cancelled in these statuses had a driver on the way, so the other
// party is told.
const TRIP_UNDER_WAY_STATUSES: readonly TripStatusEnum[] = [
  TripStatusEnum.ACCEPTED,
  TripStatusEnum.DRIVER_ARRIVED,
  TripStatusEnum.IN_PROGRESS,
];

// How the email names whoever cancelled.
const CANCELLED_BY: Record<TripActorEnum, TripCancelledByEnum> = {
  [TripActorEnum.CUSTOMER]: TripCancelledByEnum.CUSTOMER,
  [TripActorEnum.DRIVER]: TripCancelledByEnum.DRIVER,
  [TripActorEnum.ADMIN]: TripCancelledByEnum.SUPPORT,
  [TripActorEnum.SYSTEM]: TripCancelledByEnum.SUPPORT,
};

export { CANCELLED_BY, TRIP_UNDER_WAY_STATUSES };
