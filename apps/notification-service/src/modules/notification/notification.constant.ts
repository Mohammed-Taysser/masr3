import { NotificationTemplateEnum } from './notification.enum';

const MASKED_TOKEN = '***';

const PG_UNIQUE_VIOLATION = '23505';

// Security emails get the signal band and a "Security notice" line, and
// cannot be unsubscribed from.
const SECURITY_TEMPLATES: ReadonlySet<NotificationTemplateEnum> = new Set([
  NotificationTemplateEnum.NEW_LOGIN,
  NotificationTemplateEnum.PASSWORD_CHANGED,
  NotificationTemplateEnum.PASSWORD_RESET,
  NotificationTemplateEnum.PASSWORD_RESET_COMPLETED,
]);

const ACCENT_ACCOUNT = '#0F5C4D';
const ACCENT_SECURITY = '#E09A1A';

export {
  ACCENT_ACCOUNT,
  ACCENT_SECURITY,
  MASKED_TOKEN,
  PG_UNIQUE_VIOLATION,
  SECURITY_TEMPLATES,
};
