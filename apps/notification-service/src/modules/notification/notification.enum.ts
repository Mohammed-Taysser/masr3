// Every notification masr3 sends. Each value has a template folder named after
// it in kebab case (TRIP_RECEIPT → templates/trip-receipt/).
enum NotificationTypeEnum {
  WELCOME = 'WELCOME',
  NEW_LOGIN = 'NEW_LOGIN',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  PASSWORD_RESET = 'PASSWORD_RESET',
  PASSWORD_RESET_COMPLETED = 'PASSWORD_RESET_COMPLETED',
  TRIP_CONFIRMED = 'TRIP_CONFIRMED',
  TRIP_ASSIGNED = 'TRIP_ASSIGNED',
  TRIP_RECEIPT = 'TRIP_RECEIPT',
  TRIP_CANCELLED = 'TRIP_CANCELLED',
  TRIP_EXPIRED = 'TRIP_EXPIRED',
}

enum NotificationCategoryEnum {
  SECURITY = 'SECURITY',
  ACCOUNT = 'ACCOUNT',
  TRIP = 'TRIP',
}

enum NotificationChannelEnum {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP',
  PUSH = 'PUSH',
  IN_APP = 'IN_APP',
}

enum DeliveryStatusEnum {
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
}

enum DeliverySkipReasonEnum {
  RECIPIENT_NOT_FOUND = 'RECIPIENT_NOT_FOUND',
  OPTED_OUT = 'OPTED_OUT',
  PROVIDER_NOT_CONFIGURED = 'PROVIDER_NOT_CONFIGURED',
  MISSING_CONTACT = 'MISSING_CONTACT',
}

enum TemplatePartEnum {
  EMAIL_SUBJECT = 'EMAIL_SUBJECT',
  EMAIL_PREHEADER = 'EMAIL_PREHEADER',
  EMAIL_HTML = 'EMAIL_HTML',
  EMAIL_TEXT = 'EMAIL_TEXT',
  TITLE = 'TITLE',
  BODY = 'BODY',
  SHORT_TEXT = 'SHORT_TEXT',
}

enum NotificationJobEnum {
  DELIVER = 'DELIVER',
  SWEEP = 'SWEEP',
}

enum TripCancelledByEnum {
  CUSTOMER = 'CUSTOMER',
  DRIVER = 'DRIVER',
  SUPPORT = 'SUPPORT',
}

export {
  DeliverySkipReasonEnum,
  DeliveryStatusEnum,
  NotificationCategoryEnum,
  NotificationChannelEnum,
  NotificationJobEnum,
  NotificationTypeEnum,
  TemplatePartEnum,
  TripCancelledByEnum,
};
