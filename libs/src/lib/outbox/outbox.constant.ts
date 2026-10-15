// Injection tokens of OutboxModule.forRoot.
const OUTBOX_PRODUCER = 'OUTBOX_PRODUCER';
const OUTBOX_RELAY_QUEUE = 'OUTBOX_RELAY_QUEUE';

// One scheduler per queue for every instance: upserting it again only
// updates it.
const OUTBOX_RELAY_SCHEDULER_SUFFIX = '-every-interval';

// Queue names are lowercase kebab-case, prefixed with the service:
// `trip-outbox-relay`. Each service's env validation checks its
// OUTBOX_RELAY_QUEUE against it.
const QUEUE_NAME_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;

export {
  OUTBOX_PRODUCER,
  OUTBOX_RELAY_QUEUE,
  OUTBOX_RELAY_SCHEDULER_SUFFIX,
  QUEUE_NAME_PATTERN,
};
