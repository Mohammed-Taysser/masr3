import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { dayjs } from '@masr3/libs';

import NotificationDeliveryEntity from '../../entities/notification-delivery.entity';
import NotificationEntity from '../../entities/notification.entity';
import {
  ChannelProvider,
  ProviderResult,
  RenderedShortMessage,
} from '../../notification.interface';

@Injectable()
class InAppProvider implements ChannelProvider {
  readonly configured = true;

  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,
  ) {}

  async send(
    delivery: NotificationDeliveryEntity,
    message: RenderedShortMessage,
  ): Promise<ProviderResult> {
    await this.notificationRepository.update(delivery.notificationId, {
      title: message.title,
      body: message.body,
      deepLink: message.deepLink,
      inboxAt: dayjs().toDate(),
    });

    return { providerMessageId: null };
  }
}

export default InAppProvider;
