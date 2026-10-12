import { Injectable } from '@nestjs/common';

import MailService from '../../../mail/mail.service';
import NotificationDeliveryEntity from '../../entities/notification-delivery.entity';
import {
  ChannelProvider,
  ProviderResult,
  RenderedEmail,
} from '../../notification.interface';

@Injectable()
class EmailProvider implements ChannelProvider {
  readonly configured = true;

  constructor(private readonly mailService: MailService) {}

  async send(
    delivery: NotificationDeliveryEntity,
    message: RenderedEmail,
  ): Promise<ProviderResult> {
    if (!delivery.address) {
      throw new Error(`Delivery ${delivery.id} has no email address`);
    }

    const providerMessageId = await this.mailService.sendMail({
      to: delivery.address,
      subject: message.subject,
      html: message.html,
      text: message.text,
      attachments: message.attachments,
    });

    return { providerMessageId };
  }
}

export default EmailProvider;
