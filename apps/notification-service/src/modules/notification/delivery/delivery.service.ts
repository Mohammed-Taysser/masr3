import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';

import { dayjs } from '@masr3/libs';

import NotificationDeliveryEntity from '../entities/notification-delivery.entity';
import NotificationEntity from '../entities/notification.entity';
import {
  DELIVERY_STALE_AFTER_MS,
  DELIVERY_SWEEP_BATCH_SIZE,
  NOTIFICATION_CATALOG,
} from '../notification.constant';
import { DeliveryStatusEnum } from '../notification.enum';
import {
  NotificationSecrets,
  RenderedMessage,
} from '../notification.interface';
import RendererService from '../rendering/renderer.service';
import ChannelProviderRegistry from './channel-provider.registry';
import DeliveryQueueService from './delivery-queue.service';

@Injectable()
class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  constructor(
    @InjectRepository(NotificationDeliveryEntity)
    private readonly deliveryRepository: Repository<NotificationDeliveryEntity>,
    private readonly renderer: RendererService,
    private readonly providers: ChannelProviderRegistry,
    private readonly deliveryQueue: DeliveryQueueService,
  ) {}

  // Called by a channel's processor. Throws on failure so BullMQ retries;
  // after the last attempt the delivery stays FAILED.
  async deliver(
    deliveryId: number,
    secrets: NotificationSecrets | undefined,
    isLastAttempt: boolean,
  ): Promise<void> {
    const delivery = await this.deliveryRepository.findOne({
      where: { id: deliveryId },
      relations: { notification: true },
    });

    if (!delivery || delivery.status !== DeliveryStatusEnum.QUEUED) {
      return;
    }

    const attempts = delivery.attempts + 1;

    try {
      const message = this.render(delivery, delivery.notification, secrets);
      const { providerMessageId } = await this.providers
        .get(delivery.channel)
        .send(delivery, message);

      await this.deliveryRepository.update(delivery.id, {
        status: DeliveryStatusEnum.SENT,
        attempts,
        providerMessageId,
        subject: DeliveryService.subjectOf(message),
        lastError: null,
        sentAt: dayjs().toDate(),
      });
    } catch (error) {
      await this.deliveryRepository.update(delivery.id, {
        status: isLastAttempt
          ? DeliveryStatusEnum.FAILED
          : DeliveryStatusEnum.QUEUED,
        attempts,
        lastError: (error as Error).message,
      });

      throw error;
    }
  }

  // A channel without a provider still renders its message into the log, so
  // it can be checked; the delivery stays SKIPPED. Secrets arrive masked.
  async preview(
    delivery: NotificationDeliveryEntity,
    notification: NotificationEntity,
    maskedSecrets: NotificationSecrets | undefined,
  ): Promise<void> {
    try {
      const message = this.render(delivery, notification, maskedSecrets);

      await this.providers.get(delivery.channel).send(delivery, message);
    } catch (error) {
      this.logger.warn(
        `Could not preview ${delivery.channel} for notification ${notification.id}: ${(error as Error).message}`,
      );
    }
  }

  // Re-queues QUEUED deliveries whose job was never added (Redis was down at
  // commit). One that needs a secret can't be rebuilt and is marked FAILED.
  async requeueStale(): Promise<number> {
    const stale = await this.deliveryRepository.find({
      where: {
        status: DeliveryStatusEnum.QUEUED,
        createdAt: LessThan(
          dayjs().subtract(DELIVERY_STALE_AFTER_MS, 'millisecond').toDate(),
        ),
      },
      relations: { notification: true },
      order: { id: 'ASC' },
      take: DELIVERY_SWEEP_BATCH_SIZE,
    });

    const lost: number[] = [];
    let requeued = 0;

    for (const delivery of stale) {
      if (await this.deliveryQueue.hasJob(delivery)) {
        continue;
      }

      if (NOTIFICATION_CATALOG[delivery.notification.type].hasSecrets) {
        lost.push(delivery.id);
        continue;
      }

      await this.deliveryQueue.enqueue(delivery);
      requeued += 1;
    }

    if (lost.length > 0) {
      await this.deliveryRepository.update(
        { id: In(lost) },
        {
          status: DeliveryStatusEnum.FAILED,
          lastError:
            'Its job was lost and the secret it needs is gone; the user must ask again',
        },
      );
    }

    return requeued;
  }

  private render(
    delivery: NotificationDeliveryEntity,
    notification: NotificationEntity,
    secrets: NotificationSecrets | undefined,
  ): RenderedMessage {
    return this.renderer.render({
      type: notification.type,
      channel: delivery.channel,
      locale: notification.locale,
      firstName: notification.recipientName ?? '',
      address: delivery.address,
      data: notification.data,
      secrets,
      attachments: notification.attachments,
    });
  }

  private static subjectOf(message: RenderedMessage): string | null {
    if ('subject' in message) {
      return message.subject;
    }

    return 'title' in message ? message.title : null;
  }
}

export default DeliveryService;
