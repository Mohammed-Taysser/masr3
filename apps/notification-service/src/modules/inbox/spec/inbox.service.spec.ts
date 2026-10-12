import { NotFoundException } from '@nestjs/common';
import { IsNull, Not, Repository } from 'typeorm';

import NotificationEntity from '../../notification/entities/notification.entity';
import { NotificationCategoryEnum } from '../../notification/notification.enum';
import InboxService from '../inbox.service';

describe('InboxService', () => {
  let service: InboxService;
  let repository: jest.Mocked<Repository<NotificationEntity>>;

  const inbox = { userId: 1, inboxAt: Not(IsNull()), archivedAt: IsNull() };
  const item = (changes: Partial<NotificationEntity> = {}) =>
    ({ id: 12, userId: 1, readAt: null, ...changes }) as NotificationEntity;

  beforeEach(() => {
    repository = {
      findAndCount: jest.fn().mockResolvedValue([[item()], 1]),
      count: jest.fn().mockResolvedValue(3),
      findOne: jest.fn().mockResolvedValue(item()),
      update: jest.fn().mockResolvedValue({ affected: 4 }),
    } as unknown as jest.Mocked<Repository<NotificationEntity>>;
    service = new InboxService(repository);
  });

  it('lists my inbox newest first, archived items left out', async () => {
    const page = await service.list(1, { page: 2, limit: 10 });

    expect(repository.findAndCount).toHaveBeenCalledWith({
      where: inbox,
      order: { inboxAt: 'DESC', id: 'DESC' },
      skip: 10,
      take: 10,
    });
    expect(page.meta.total).toBe(1);
  });

  it('filters by unread and category when asked', async () => {
    await service.list(1, {
      unread: true,
      category: NotificationCategoryEnum.TRIP,
      page: 1,
      limit: 20,
    });

    expect(repository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ...inbox,
          readAt: IsNull(),
          category: NotificationCategoryEnum.TRIP,
        },
      }),
    );
  });

  it('counts unread items', async () => {
    await expect(service.unreadCount(1)).resolves.toBe(3);
    expect(repository.count).toHaveBeenCalledWith({
      where: { ...inbox, readAt: IsNull() },
    });
  });

  it('marks one read, once', async () => {
    const read = await service.markRead(1, 12);

    expect(read.readAt).toBeInstanceOf(Date);
    expect(repository.update).toHaveBeenCalledTimes(1);

    repository.findOne.mockResolvedValue(item({ readAt: read.readAt }));
    await service.markRead(1, 12);
    expect(repository.update).toHaveBeenCalledTimes(1);
  });

  it('marks one unread', async () => {
    repository.findOne.mockResolvedValue(item({ readAt: new Date() }));

    await expect(service.markUnread(1, 12)).resolves.toEqual(
      expect.objectContaining({ readAt: null }),
    );
    expect(repository.update).toHaveBeenCalledWith(12, { readAt: null });
  });

  it('marks everything read and says how many changed', async () => {
    await expect(service.markAllRead(1)).resolves.toBe(4);
    expect(repository.update).toHaveBeenCalledWith(
      { ...inbox, readAt: IsNull() },
      { readAt: expect.any(Date) },
    );
  });

  it('archives instead of deleting', async () => {
    await service.archive(1, 12);

    expect(repository.update).toHaveBeenCalledWith(12, {
      archivedAt: expect.any(Date),
    });
  });

  it("answers 404 for someone else's item or one not in the inbox", async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(service.markRead(1, 99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { ...inbox, id: 99 },
    });
  });
});
