import {
  AuthEventMap,
  AuthKafkaTopic,
  AuditEventMap,
  TripEventMap,
} from '@masr3/libs/kafka';

// Every topic trip-service publishes through its outbox.
type OutboxEventMap = TripEventMap & AuditEventMap;

// The topics this service consumes, and the events they carry.
type ConsumedKafkaTopic = AuthKafkaTopic.USER_CHANGED;

type ConsumedEventMap = Pick<AuthEventMap, ConsumedKafkaTopic>;

export type { ConsumedEventMap, ConsumedKafkaTopic, OutboxEventMap };
