// Key for pg_try_advisory_xact_lock: only one relay publishes at a time, which
// keeps each user's audit events in order across instances.
const OUTBOX_RELAY_LOCK_ID = 7000001;

// Redis is shared by every service and BullMQ has no per-service prefix here:
// trip-service already owns OUTBOX-RELAY, so this name must differ or its
// worker would take auth-service's relay jobs.
const OUTBOX_RELAY_QUEUE = 'AUTH-OUTBOX-RELAY';
// One scheduler for every instance: upserting it again only updates it.
const OUTBOX_RELAY_SCHEDULER_ID = 'AUTH-OUTBOX-RELAY-EVERY-INTERVAL';

export { OUTBOX_RELAY_LOCK_ID, OUTBOX_RELAY_QUEUE, OUTBOX_RELAY_SCHEDULER_ID };
