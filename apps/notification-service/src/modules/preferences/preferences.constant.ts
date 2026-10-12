import { NotificationChannelEnum } from '../notification/notification.enum';
import { ChannelPreferences, ChannelSwitch } from './preferences.interface';

const UQ_NOTIFICATION_PREFERENCES_USER = 'UQ_notification_preferences_user';

// The column holding each channel's switch.
const CHANNEL_SWITCHES: Record<NotificationChannelEnum, ChannelSwitch> = {
  [NotificationChannelEnum.EMAIL]: 'email',
  [NotificationChannelEnum.SMS]: 'sms',
  [NotificationChannelEnum.WHATSAPP]: 'whatsapp',
  [NotificationChannelEnum.PUSH]: 'push',
  [NotificationChannelEnum.IN_APP]: 'inApp',
};

// Everything is on until the user turns something off.
const DEFAULT_CHANNEL_PREFERENCES: ChannelPreferences = {
  email: true,
  sms: true,
  whatsapp: true,
  push: true,
  inApp: true,
};

export {
  CHANNEL_SWITCHES,
  DEFAULT_CHANNEL_PREFERENCES,
  UQ_NOTIFICATION_PREFERENCES_USER,
};
