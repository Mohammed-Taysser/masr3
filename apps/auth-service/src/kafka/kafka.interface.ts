import { AuditEventMap, AuthEventMap, AuthKafkaTopic } from '@masr3/libs/kafka';

// Every topic auth-service publishes through its outbox. The other auth.*
// topics are still published directly, best effort.
type OutboxEventMap = AuditEventMap &
  Pick<AuthEventMap, AuthKafkaTopic.USER_CHANGED>;

export type { OutboxEventMap };
