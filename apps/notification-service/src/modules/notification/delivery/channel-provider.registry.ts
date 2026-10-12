import { Injectable } from '@nestjs/common';

import { NotificationChannelEnum } from '../notification.enum';
import { ChannelProvider } from '../notification.interface';
import EmailProvider from './providers/email.provider';
import InAppProvider from './providers/in-app.provider';
import LogProvider from './providers/log.provider';

@Injectable()
class ChannelProviderRegistry {
  private readonly providers: Record<NotificationChannelEnum, ChannelProvider>;

  constructor(
    emailProvider: EmailProvider,
    inAppProvider: InAppProvider,
    logProvider: LogProvider,
  ) {
    this.providers = {
      [NotificationChannelEnum.EMAIL]: emailProvider,
      [NotificationChannelEnum.IN_APP]: inAppProvider,
      [NotificationChannelEnum.SMS]: logProvider,
      [NotificationChannelEnum.WHATSAPP]: logProvider,
      [NotificationChannelEnum.PUSH]: logProvider,
    };
  }

  get(channel: NotificationChannelEnum): ChannelProvider {
    return this.providers[channel];
  }
}

export default ChannelProviderRegistry;
