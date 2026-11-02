import { TripActorEnum, TripStatusEnum } from '@masr3/libs/kafka';

import TripEntity from './entities/trip.entity';

interface TransitionTripCommand {
  tripId: number;
  to: TripStatusEnum;
  actor: TripActorEnum;
  // Null only when actor is SYSTEM.
  actorId: number | null;
  reason?: string;
  changes?: Partial<Pick<TripEntity, 'driverId' | 'agreedFare'>>;
  // Set when accepting: that offer becomes ACCEPTED, every other one REJECTED.
  acceptedOfferId?: number;
}

interface ExpireTripJobData {
  tripId: number;
}

export type { ExpireTripJobData, TransitionTripCommand };
