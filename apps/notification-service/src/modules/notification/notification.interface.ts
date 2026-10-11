import {
  NotificationChannelEnum,
  NotificationTemplateEnum,
} from './notification.enum';

interface SendNotificationCommand {
  channel: NotificationChannelEnum;
  recipient: string;
  template: NotificationTemplateEnum;
  subject: string;
  text: string;
  html?: string;
  persistedBody?: string;
  eventId: string;
}

interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

type TemplateVars = Record<string, string>;

export type { EmailContent, SendNotificationCommand, TemplateVars };
