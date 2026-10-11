enum NotificationChannelEnum {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
}

enum NotificationStatusEnum {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

// Each value is a file name under templates/html and templates/text.
enum NotificationTemplateEnum {
  WELCOME = 'welcome',
  NEW_LOGIN = 'new-login',
  PASSWORD_CHANGED = 'password-changed',
  PASSWORD_RESET = 'password-reset',
  PASSWORD_RESET_COMPLETED = 'password-reset-completed',
}

export {
  NotificationChannelEnum,
  NotificationStatusEnum,
  NotificationTemplateEnum,
};
