// Key for pg_try_advisory_xact_lock: only one relay publishes at a time, which
// keeps each trip's events in order across instances.
const OUTBOX_RELAY_LOCK_ID = 7002001;

export { OUTBOX_RELAY_LOCK_ID };
