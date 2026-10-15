import { AuditEventMap } from '@masr3/libs/kafka';

// Every topic vehicle-service publishes through its outbox.
type OutboxEventMap = AuditEventMap;

export type { OutboxEventMap };
