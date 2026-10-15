// EXPIRE_TRIP is delayed until one trip's expiresAt. SWEEP runs on a schedule
// and catches any trip whose job was never queued.
enum TripExpiryJobEnum {
  EXPIRE_TRIP = 'EXPIRE_TRIP',
  SWEEP = 'SWEEP',
}

export { TripExpiryJobEnum };
