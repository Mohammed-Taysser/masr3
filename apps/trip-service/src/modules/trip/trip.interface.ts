import { TripActorEnum, TripStatusEnum, TripTypeEnum } from '@masr3/libs';

import TripEntity from './entities/trip.entity';

interface CreateTripCommand {
  customerId: number;
  type: TripTypeEnum;
  pickupLatitude: number;
  pickupLongitude: number;
  pickupAddress: string;
  dropoffLatitude: number;
  dropoffLongitude: number;
  dropoffAddress: string;
  proposedFare: number;
  recipientName?: string;
  recipientPhone?: string;
  packageDescription?: string;
}

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

export type { CreateTripCommand, TransitionTripCommand };
