import { AuditEventMap, AuthEventMap, AuthKafkaTopic } from '@masr3/libs/kafka';

// Published directly, best effort: it carries the raw reset token, which must
// never sit in outbox_events.
type DirectAuthKafkaTopic = AuthKafkaTopic.PASSWORD_RESET_REQUESTED;

// The auth.* events notification-service turns into emails, sent through the
// outbox in the same transaction as the change they report.
type OutboxAuthKafkaTopic = Exclude<
  AuthKafkaTopic,
  AuthKafkaTopic.USER_CHANGED | DirectAuthKafkaTopic
>;

// Every topic auth-service publishes through its outbox.
type OutboxEventMap = AuditEventMap &
  Pick<AuthEventMap, AuthKafkaTopic.USER_CHANGED | OutboxAuthKafkaTopic>;

export type { DirectAuthKafkaTopic, OutboxAuthKafkaTopic, OutboxEventMap };
