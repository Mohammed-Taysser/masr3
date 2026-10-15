import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, Not, Repository } from 'typeorm';

import { dayjs } from '@masr3/libs/date';
import { paginate, Paginated, paginationWindow } from '@masr3/libs/pagination';

import NotificationEntity from '../notification/entities/notification.entity';
import ListInboxQueryDto from './dto/list-inbox-query.dto';

@Injectable()
class InboxService {
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,
  ) {}

  async list(
    userId: number,
    query: ListInboxQueryDto,
  ): Promise<Paginated<NotificationEntity>> {
    const [items, total] = await this.notificationRepository.findAndCount({
      where: InboxService.prepareListWhere(userId, query),
      order: { inboxAt: 'DESC', id: 'DESC' },
      ...paginationWindow(query),
    });

    return paginate(items, total, query);
  }

  async unreadCount(userId: number): Promise<number> {
    return this.notificationRepository.count({
      where: { ...InboxService.inboxOf(userId), readAt: IsNull() },
    });
  }

  async markRead(userId: number, id: number): Promise<NotificationEntity> {
    const item = await this.findOneOrFail(userId, id);

    if (!item.readAt) {
      item.readAt = dayjs().toDate();
      await this.notificationRepository.update(item.id, {
        readAt: item.readAt,
      });
    }

    return item;
  }

  async markUnread(userId: number, id: number): Promise<NotificationEntity> {
    const item = await this.findOneOrFail(userId, id);

    if (item.readAt) {
      item.readAt = null;
      await this.notificationRepository.update(item.id, { readAt: null });
    }

    return item;
  }

  async markAllRead(userId: number): Promise<number> {
    const result = await this.notificationRepository.update(
      { ...InboxService.inboxOf(userId), readAt: IsNull() },
      { readAt: dayjs().toDate() },
    );

    return result.affected ?? 0;
  }

  async archive(userId: number, id: number): Promise<void> {
    await this.findOneOrFail(userId, id);

    await this.notificationRepository.update(id, {
      archivedAt: dayjs().toDate(),
    });
  }

  // Someone else's item, or one not in the inbox, is a 404 like any missing one.
  private async findOneOrFail(
    userId: number,
    id: number,
  ): Promise<NotificationEntity> {
    const item = await this.notificationRepository.findOne({
      where: { ...InboxService.inboxOf(userId), id },
    });

    if (!item) {
      throw new NotFoundException(`Notification ${id} not found`);
    }

    return item;
  }

  private static prepareListWhere(
    userId: number,
    query: ListInboxQueryDto,
  ): FindOptionsWhere<NotificationEntity> {
    return {
      ...InboxService.inboxOf(userId),
      ...(query.unread && { readAt: IsNull() }),
      ...(query.category && { category: query.category }),
    };
  }

  private static inboxOf(userId: number): FindOptionsWhere<NotificationEntity> {
    return { userId, inboxAt: Not(IsNull()), archivedAt: IsNull() };
  }
}

export default InboxService;
