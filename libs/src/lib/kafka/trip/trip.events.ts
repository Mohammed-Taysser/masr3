import { BaseKafkaEvent } from '../kafka.events';
import { TripActorEnum, TripStatusEnum, TripTypeEnum } from './trip.enum';
import { TripKafkaTopic } from './trip.topics';

interface TripStatusChangedEvent extends BaseKafkaEvent {
  tripId: number;
  type: TripTypeEnum;
  customerId: number;
  driverId: number | null;
  // Null on the event that records the trip's creation.
  fromStatus: TripStatusEnum | null;
  toStatus: TripStatusEnum;
  actor: TripActorEnum;
  actorId: number | null;
  reason: string | null;
  pickupAddress: string;
  dropoffAddress: string;
  proposedFare: number;
  agreedFare: number | null;
  // ISO 4217 code of both fares, e.g. EGP.
  currency: string;
}

interface TripEventMap {
  [TripKafkaTopic.STATUS_CHANGED]: TripStatusChangedEvent;
}

export type { TripEventMap, TripStatusChangedEvent };
