import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

import PreferencesService from '../preferences/preferences.service';
import ChannelProviderRegistry from './delivery/channel-provider.registry';
import DeliveryQueueService from './delivery/delivery-queue.service';
import DeliveryService from './delivery/delivery.service';
import NotificationDeliveryEntity from './entities/notification-delivery.entity';
import NotificationEntity from './entities/notification.entity';
import { DEFAULT_LOCALE, NOTIFICATION_CATALOG } from './notification.constant';
import {
  DeliverySkipReasonEnum,
  DeliveryStatusEnum,
  NotificationChannelEnum,
} from './notification.enum';
import {
  NotificationIntent,
  NotificationSecrets,
  PlannedDelivery,
  Recipient,
  SavedNotification,
} from './notification.interface';
import RecipientService from './recipient.service';

@Injectable()
class NotifierService {
  private readonly logger = new Logger(NotifierService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly recipientService: RecipientService,
    private readonly preferencesService: PreferencesService,
    private readonly providers: ChannelProviderRegistry,
    private readonly deliveryQueue: DeliveryQueueService,
    private readonly deliveryService: DeliveryService,
  ) {}

  async notify(intents: NotificationIntent[]): Promise<void> {
    for (const intent of intents) {
      await this.notifyOne(intent);
    }
  }

  private async notifyOne(intent: NotificationIntent): Promise<void> {
    const entry = NOTIFICATION_CATALOG[intent.type];

    const recipient = await this.recipientService.find(intent.userId);

    const optedOut =
      recipient && !entry.mandatory
        ? await this.preferencesService.disabledChannels(intent.userId)
        : new Set<NotificationChannelEnum>();

    const planned = (intent.channels ?? entry.defaultChannels).map((channel) =>
      this.plan(channel, recipient, optedOut),
    );

    const saved = await this.save(intent, recipient, planned);

    if (!saved) {
      return;
    }

    for (const delivery of saved.deliveries) {
      await this.dispatch(delivery, saved.notification, intent.secrets);
    }
  }

  private plan(
    channel: NotificationChannelEnum,
    recipient: Recipient | null,
    optedOut: Set<NotificationChannelEnum>,
  ): PlannedDelivery {
    const address = recipient && NotifierService.addressFor(channel, recipient);
    const skipReason = this.skipReason(channel, recipient, address, optedOut);

    return {
      channel,
      address,
      skipReason,
      status: skipReason
        ? DeliveryStatusEnum.SKIPPED
        : DeliveryStatusEnum.QUEUED,
    };
  }

  // The first reason that applies wins; null means the channel can be used.
  private skipReason(
    channel: NotificationChannelEnum,
    recipient: Recipient | null,
    address: string | null,
    optedOut: Set<NotificationChannelEnum>,
  ): DeliverySkipReasonEnum | null {
    if (!recipient) {
      return DeliverySkipReasonEnum.RECIPIENT_NOT_FOUND;
    }

    if (optedOut.has(channel)) {
      return DeliverySkipReasonEnum.OPTED_OUT;
    }

    if (!this.providers.get(channel).configured) {
      return DeliverySkipReasonEnum.PROVIDER_NOT_CONFIGURED;
    }

    return address ? null : DeliverySkipReasonEnum.MISSING_CONTACT;
  }

  private async save(
    intent: NotificationIntent,
    recipient: Recipient | null,
    planned: PlannedDelivery[],
  ): Promise<SavedNotification | null> {
    return this.dataSource.transaction(async (manager) => {
      const inserted = await manager
        .createQueryBuilder()
        .insert()
        .into(NotificationEntity)
        .values({
          type: intent.type,
          category: NOTIFICATION_CATALOG[intent.type].category,
          userId: intent.userId,
          dedupeKey: intent.dedupeKey,
          data: intent.data,
          attachments: intent.attachments ?? null,
          locale: recipient?.locale ?? DEFAULT_LOCALE,
          recipientName: recipient?.firstName ?? null,
        })
        .orIgnore()
        .returning('*')
        .execute();

      const [row] = inserted.raw as NotificationEntity[];

      if (!row) {
        this.logger.debug(`Notification ${intent.dedupeKey} already handled`);

        return null;
      }

      const deliveries = await manager.save(
        NotificationDeliveryEntity,
        planned.map((delivery) =>
          manager.create(NotificationDeliveryEntity, {
            ...delivery,
            notificationId: row.id,
          }),
        ),
      );

      return { notification: row, deliveries };
    });
  }

  private async dispatch(
    delivery: NotificationDeliveryEntity,
    notification: NotificationEntity,
    secrets: NotificationSecrets | undefined,
  ): Promise<void> {
    if (delivery.status === DeliveryStatusEnum.QUEUED) {
      try {
        await this.deliveryQueue.enqueue(delivery, secrets);
      } catch (error) {
        this.logger.warn(
          `Queueing delivery ${delivery.id} failed; the sweep will retry: ${(error as Error).message}`,
        );
      }

      return;
    }

    if (
      delivery.skipReason === DeliverySkipReasonEnum.PROVIDER_NOT_CONFIGURED
    ) {
      await this.deliveryService.preview(
        delivery,
        notification,
        secrets && NotifierService.mask(secrets),
      );
    }
  }

  private static addressFor(
    channel: NotificationChannelEnum,
    recipient: Recipient,
  ): string | null {
    switch (channel) {
      case NotificationChannelEnum.EMAIL:
        return recipient.email;
      case NotificationChannelEnum.SMS:
      case NotificationChannelEnum.WHATSAPP:
        return recipient.phone;
      case NotificationChannelEnum.PUSH:
        return recipient.deviceToken;
      case NotificationChannelEnum.IN_APP:
        return String(recipient.userId);
    }
  }

  private static mask(secrets: NotificationSecrets): NotificationSecrets {
    return Object.fromEntries(Object.keys(secrets).map((key) => [key, '***']));
  }
}

export default NotifierService;
