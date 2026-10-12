import NotificationPreferenceEntity from './entities/notification-preference.entity';

type ChannelSwitch = keyof Pick<
  NotificationPreferenceEntity,
  'email' | 'sms' | 'whatsapp' | 'push' | 'inApp'
>;

type ChannelPreferences = Record<ChannelSwitch, boolean>;

export type { ChannelPreferences, ChannelSwitch };
