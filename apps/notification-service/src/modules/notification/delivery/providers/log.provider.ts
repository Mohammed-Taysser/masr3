import { Injectable, Logger } from '@nestjs/common';

import NotificationDeliveryEntity from '../../entities/notification-delivery.entity';
import {
  ChannelProvider,
  ProviderResult,
  RenderedMessage,
} from '../../notification.interface';

@Injectable()
class LogProvider implements ChannelProvider {
  readonly configured = false;
  private readonly logger = new Logger(LogProvider.name);

  async send(
    delivery: NotificationDeliveryEntity,
    message: RenderedMessage,
  ): Promise<ProviderResult> {
    const content =
      'text' in message ? message.text : `${message.title} | ${message.body}`;

    this.logger.log(
      `[${delivery.channel} not configured] notification ${delivery.notificationId} to ${LogProvider.mask(delivery.address)}: ${content}`,
    );

    return { providerMessageId: null };
  }

  private static mask(address: string | null): string {
    if (!address) {
      return '(no address)';
    }

    return `${address.slice(0, 2)}***`;
  }
}

export default LogProvider;
