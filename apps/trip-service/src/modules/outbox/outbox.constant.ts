// Key for pg_try_advisory_xact_lock: only one relay publishes at a time, which
// keeps each trip's events in order across instances.
const OUTBOX_RELAY_LOCK_ID = 7002001;

const OUTBOX_RELAY_QUEUE = 'OUTBOX-RELAY';
// One scheduler for every instance: upserting it again only updates it.
const OUTBOX_RELAY_SCHEDULER_ID = 'OUTBOX-RELAY-EVERY-INTERVAL';

export { OUTBOX_RELAY_LOCK_ID, OUTBOX_RELAY_QUEUE, OUTBOX_RELAY_SCHEDULER_ID };
