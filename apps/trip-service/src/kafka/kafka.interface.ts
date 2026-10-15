import { AuditEventMap, TripEventMap } from '@masr3/libs/kafka';

// Every topic trip-service publishes through its outbox.
type OutboxEventMap = TripEventMap & AuditEventMap;

export type { OutboxEventMap };
