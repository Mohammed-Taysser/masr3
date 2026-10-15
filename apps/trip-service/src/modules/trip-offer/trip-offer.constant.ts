import type TripOfferEntity from './entities/trip-offer.entity';

// One pending offer per driver per trip.
const UQ_TRIP_OFFERS_PENDING_DRIVER = 'UQ_trip_offers_pending_driver';

const TRIP_OFFER_AUDITED_FIELDS: readonly (keyof TripOfferEntity & string)[] = [
  'tripId',
  'driverId',
  'amount',
  'status',
];

export { TRIP_OFFER_AUDITED_FIELDS, UQ_TRIP_OFFERS_PENDING_DRIVER };
