import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';

import { Paginated } from '../../../shared/pagination/pagination.interface';
import { paginate } from '../../../shared/pagination/pagination';
import ListDeliveriesQueryDto from '../dto/list-deliveries-query.dto';
import NotificationDeliveryEntity from '../entities/notification-delivery.entity';
import { NOTIFICATION_CATALOG } from '../notification.constant';
import { DeliveryStatusEnum } from '../notification.enum';
import DeliveryQueueService from './delivery-queue.service';

@Injectable()
class DeliveryLogService {
  constructor(
    @InjectRepository(NotificationDeliveryEntity)
    private readonly deliveryRepository: Repository<NotificationDeliveryEntity>,
    private readonly deliveryQueue: DeliveryQueueService,
  ) {}

  async list(
    query: ListDeliveriesQueryDto,
  ): Promise<Paginated<NotificationDeliveryEntity>> {
    const [items, total] = await this.deliveryRepository.findAndCount({
      where: DeliveryLogService.prepareListWhere(query),
      relations: { notification: true },
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    return paginate(items, total, query.page, query.limit);
  }

  async retry(id: number): Promise<NotificationDeliveryEntity> {
    const delivery = await this.deliveryRepository.findOne({
      where: { id },
      relations: { notification: true },
    });

    if (!delivery) {
      throw new NotFoundException(`Delivery ${id} not found`);
    }

    if (delivery.status !== DeliveryStatusEnum.FAILED) {
      throw new ConflictException(
        `Only a FAILED delivery can be retried; this one is ${delivery.status}`,
      );
    }

    await this.deliveryRepository.update(id, {
      status: DeliveryStatusEnum.QUEUED,
      lastError: null,
    });

    const isQueued = await this.deliveryQueue.retry(
      delivery,
      NOTIFICATION_CATALOG[delivery.notification.type].hasSecrets,
    );

    if (!isQueued) {
      await this.deliveryRepository.update(id, {
        status: DeliveryStatusEnum.FAILED,
        lastError: delivery.lastError,
      });

      throw new ConflictException(
        'This delivery needs a secret that is no longer available; the user must ask again',
      );
    }

    return { ...delivery, status: DeliveryStatusEnum.QUEUED, lastError: null };
  }

  private static prepareListWhere(
    query: ListDeliveriesQueryDto,
  ): FindOptionsWhere<NotificationDeliveryEntity> {
    return {
      ...(query.status && { status: query.status }),
      ...(query.channel && { channel: query.channel }),
      ...(query.userId && { notification: { userId: query.userId } }),
    };
  }
}

export default DeliveryLogService;
