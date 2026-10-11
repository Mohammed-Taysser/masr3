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
  proposedFare: number;
  agreedFare: number | null;
}

interface TripEventMap {
  [TripKafkaTopic.STATUS_CHANGED]: TripStatusChangedEvent;
}

export type { TripEventMap, TripStatusChangedEvent };
