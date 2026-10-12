import {
  NotificationCategoryEnum,
  NotificationChannelEnum,
  NotificationTypeEnum,
  TemplatePartEnum,
} from './notification.enum';
import { CatalogEntry } from './notification.interface';

const { EMAIL, SMS, PUSH, IN_APP } = NotificationChannelEnum;
const { SECURITY, ACCOUNT, TRIP } = NotificationCategoryEnum;

const TRIP_DEEP_LINK = 'masr3://trips/{{tripId}}';

// What exists, who it is for and where it goes by default. Adding a
// notification means an entry here, a data interface, templates and a mapping
// in an event handler.
const NOTIFICATION_CATALOG: Record<NotificationTypeEnum, CatalogEntry> = {
  [NotificationTypeEnum.WELCOME]: {
    category: ACCOUNT,
    defaultChannels: [EMAIL, IN_APP],
    mandatory: false,
    hasSecrets: false,
    deepLink: null,
  },
  [NotificationTypeEnum.NEW_LOGIN]: {
    category: SECURITY,
    defaultChannels: [EMAIL, IN_APP],
    mandatory: true,
    hasSecrets: false,
    deepLink: null,
  },
  [NotificationTypeEnum.PASSWORD_CHANGED]: {
    category: SECURITY,
    defaultChannels: [EMAIL],
    mandatory: true,
    hasSecrets: false,
    deepLink: null,
  },
  [NotificationTypeEnum.PASSWORD_RESET]: {
    category: SECURITY,
    defaultChannels: [EMAIL],
    mandatory: true,
    hasSecrets: true,
    deepLink: null,
  },
  [NotificationTypeEnum.PASSWORD_RESET_COMPLETED]: {
    category: SECURITY,
    defaultChannels: [EMAIL],
    mandatory: true,
    hasSecrets: false,
    deepLink: null,
  },
  [NotificationTypeEnum.TRIP_CONFIRMED]: {
    category: TRIP,
    defaultChannels: [EMAIL, PUSH, IN_APP],
    mandatory: false,
    hasSecrets: false,
    deepLink: TRIP_DEEP_LINK,
  },
  [NotificationTypeEnum.TRIP_ASSIGNED]: {
    category: TRIP,
    defaultChannels: [EMAIL, PUSH, SMS, IN_APP],
    mandatory: false,
    hasSecrets: false,
    deepLink: TRIP_DEEP_LINK,
  },
  [NotificationTypeEnum.TRIP_RECEIPT]: {
    category: TRIP,
    defaultChannels: [EMAIL, IN_APP],
    mandatory: false,
    hasSecrets: false,
    deepLink: TRIP_DEEP_LINK,
  },
  [NotificationTypeEnum.TRIP_CANCELLED]: {
    category: TRIP,
    defaultChannels: [EMAIL, PUSH, SMS, IN_APP],
    mandatory: false,
    hasSecrets: false,
    deepLink: TRIP_DEEP_LINK,
  },
  [NotificationTypeEnum.TRIP_EXPIRED]: {
    category: TRIP,
    defaultChannels: [EMAIL, PUSH, IN_APP],
    mandatory: false,
    hasSecrets: false,
    deepLink: TRIP_DEEP_LINK,
  },
};

// The template files each channel renders. PUSH and IN_APP share a title and
// body; SMS and WhatsApp share one short text.
const CHANNEL_TEMPLATE_PARTS: Record<
  NotificationChannelEnum,
  TemplatePartEnum[]
> = {
  [EMAIL]: [
    TemplatePartEnum.EMAIL_SUBJECT,
    TemplatePartEnum.EMAIL_PREHEADER,
    TemplatePartEnum.EMAIL_HTML,
    TemplatePartEnum.EMAIL_TEXT,
  ],
  [PUSH]: [TemplatePartEnum.TITLE, TemplatePartEnum.BODY],
  [IN_APP]: [TemplatePartEnum.TITLE, TemplatePartEnum.BODY],
  [SMS]: [TemplatePartEnum.SHORT_TEXT],
  [NotificationChannelEnum.WHATSAPP]: [TemplatePartEnum.SHORT_TEXT],
};

const TEMPLATE_PART_FILES: Record<TemplatePartEnum, string> = {
  [TemplatePartEnum.EMAIL_SUBJECT]: 'email-subject',
  [TemplatePartEnum.EMAIL_PREHEADER]: 'email-preheader',
  [TemplatePartEnum.EMAIL_HTML]: 'email-html',
  [TemplatePartEnum.EMAIL_TEXT]: 'email-text',
  [TemplatePartEnum.TITLE]: 'title',
  [TemplatePartEnum.BODY]: 'body',
  [TemplatePartEnum.SHORT_TEXT]: 'short-text',
};

const DEFAULT_LOCALE = 'en';

// Folders under templates/ that are not notification types.
const TEMPLATE_LAYOUTS_DIRECTORY = 'layouts';
const TEMPLATE_PARTIALS_DIRECTORY = 'partials';
const TEMPLATE_FOOTERS_DIRECTORY = 'footers';
const TEMPLATE_EXTENSION = '.hbs';
const EMAIL_HTML_LAYOUT = 'email-html';
const EMAIL_TEXT_LAYOUT = 'email-text';
const RIGHT_TO_LEFT_LOCALES: readonly string[] = ['ar'];

const CATEGORY_ACCENTS: Record<NotificationCategoryEnum, string> = {
  [SECURITY]: '#E09A1A',
  [ACCOUNT]: '#0F5C4D',
  [TRIP]: '#0F5C4D',
};

// BullMQ. Only channels with a real provider have a queue; the others are
// recorded as skipped and previewed in the log.
const NOTIFICATION_EMAIL_QUEUE = 'NOTIFICATION-EMAIL';
const NOTIFICATION_IN_APP_QUEUE = 'NOTIFICATION-IN-APP';
const NOTIFICATION_SWEEP_QUEUE = 'NOTIFICATION-SWEEP';
const NOTIFICATION_SWEEP_SCHEDULER_ID = 'NOTIFICATION-DELIVERY-SWEEP';

const DELIVERY_ATTEMPTS = 5;
const DELIVERY_BACKOFF_MS = 10000;
const DELIVERY_SWEEP_INTERVAL_MS = 60000;
// A QUEUED delivery this old with no job lost its job (Redis was down when it
// was queued) and is queued again by the sweep.
const DELIVERY_STALE_AFTER_MS = 120000;
const DELIVERY_SWEEP_BATCH_SIZE = 100;

const UQ_NOTIFICATIONS_DEDUPE_KEY = 'UQ_notifications_dedupe_key';
const UQ_NOTIFICATION_DELIVERIES_CHANNEL = 'UQ_notification_deliveries_channel';

export {
  CATEGORY_ACCENTS,
  CHANNEL_TEMPLATE_PARTS,
  DEFAULT_LOCALE,
  EMAIL_HTML_LAYOUT,
  EMAIL_TEXT_LAYOUT,
  DELIVERY_ATTEMPTS,
  DELIVERY_BACKOFF_MS,
  DELIVERY_STALE_AFTER_MS,
  DELIVERY_SWEEP_BATCH_SIZE,
  DELIVERY_SWEEP_INTERVAL_MS,
  NOTIFICATION_CATALOG,
  NOTIFICATION_EMAIL_QUEUE,
  NOTIFICATION_IN_APP_QUEUE,
  NOTIFICATION_SWEEP_QUEUE,
  NOTIFICATION_SWEEP_SCHEDULER_ID,
  RIGHT_TO_LEFT_LOCALES,
  TEMPLATE_EXTENSION,
  TEMPLATE_FOOTERS_DIRECTORY,
  TEMPLATE_LAYOUTS_DIRECTORY,
  TEMPLATE_PART_FILES,
  TEMPLATE_PARTIALS_DIRECTORY,
  UQ_NOTIFICATION_DELIVERIES_CHANNEL,
  UQ_NOTIFICATIONS_DEDUPE_KEY,
};
