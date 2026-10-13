// Producers retry through their outbox and Kafka delivers at least once, so the
// same event can arrive twice: this index makes the second insert a no-op.
const UQ_AUDITS_EVENT_ID = 'UQ_audits_event_id';

// The largest value a Postgres int column holds; a larger id would fail the
// insert and stall the partition.
const POSTGRES_INT_MAX = 2147483647;

export { POSTGRES_INT_MAX, UQ_AUDITS_EVENT_ID };
