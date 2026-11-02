import { AuthEventMap, AuthKafkaTopic, AuditEventMap } from '@masr3/libs/kafka';

// Every topic vehicle-service publishes through its outbox.
type OutboxEventMap = AuditEventMap;

// The topics this service consumes, and the events they carry.
type ConsumedKafkaTopic = AuthKafkaTopic.USER_CHANGED;

type ConsumedEventMap = Pick<AuthEventMap, ConsumedKafkaTopic>;

export type { ConsumedEventMap, ConsumedKafkaTopic, OutboxEventMap };
