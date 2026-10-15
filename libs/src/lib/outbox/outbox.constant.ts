// Injection token of the relay's queue, registered by OutboxModule.forRoot.
const OUTBOX_RELAY_QUEUE = 'OUTBOX_RELAY_QUEUE';

// One scheduler per queue for every instance: upserting it again only
// updates it.
const OUTBOX_RELAY_SCHEDULER_SUFFIX = '-every-interval';

// Queue names are lowercase kebab-case, prefixed with the service:
// `trip-outbox-relay`. OutboxModule.forRoot checks the relay's queue against
// it.
const QUEUE_NAME_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;

export {
  OUTBOX_RELAY_QUEUE,
  OUTBOX_RELAY_SCHEDULER_SUFFIX,
  QUEUE_NAME_PATTERN,
};
