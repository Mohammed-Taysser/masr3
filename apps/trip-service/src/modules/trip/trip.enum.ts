// EXPIRE_TRIP is delayed until one trip's expiresAt. SWEEP runs on a schedule
// and catches any trip whose job was never queued.
enum TripExpiryJobEnum {
  EXPIRE_TRIP = 'EXPIRE_TRIP',
  SWEEP = 'SWEEP',
}

// ALL: every trip (admin). MINE: the caller's own, as customer or assigned
// driver. OPEN: REQUESTED trips still taking offers.
enum TripListScopeEnum {
  ALL = 'ALL',
  MINE = 'MINE',
  OPEN = 'OPEN',
}

export { TripExpiryJobEnum, TripListScopeEnum };
