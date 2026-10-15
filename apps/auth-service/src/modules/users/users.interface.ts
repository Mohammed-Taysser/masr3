import { OutboxAuthKafkaTopic } from '../../kafka/kafka.interface';

interface PasswordResetTokenOptions {
  tokenHash: string;
  expiresAt: Date;
}

interface AuditedWriteOptions {
  metadata?: Record<string, unknown>;
  // The auth.* event this write reports, enqueued in its transaction.
  event?: OutboxAuthKafkaTopic;
}

export type { AuditedWriteOptions, PasswordResetTokenOptions };
