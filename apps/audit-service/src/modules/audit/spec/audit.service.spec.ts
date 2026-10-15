import { NotFoundException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';

import { UserRoleEnum } from '@masr3/libs/auth';
import {
  AuditActionEnum,
  AuditActionRecordedEvent,
  AuditActorTypeEnum,
  AuditEntityTypeEnum,
} from '@masr3/libs/kafka';

import AuditService from '../audit.service';
import { UQ_AUDITS_EVENT_ID } from '../audit.constant';
import AuditEntity from '../entities/audit.entity';

describe('AuditService', () => {
  let service: AuditService;
  let repository: jest.Mocked<Repository<AuditEntity>>;

  const event: AuditActionRecordedEvent = {
    eventId: 'event-1',
    occurredAt: '2026-10-01T12:00:00.000Z',
    schemaVersion: 1,
    service: 'trip-service',
    action: AuditActionEnum.STATUS_CHANGED,
    entity: { type: AuditEntityTypeEnum.TRIP, id: 42 },
    actor: { type: AuditActorTypeEnum.USER, id: 7, role: UserRoleEnum.DRIVER },
    changes: { status: { old: 'REQUESTED', new: 'ACCEPTED' } },
    metadata: { reason: null },
  };

  const uniqueViolation = (constraint: string) =>
    new QueryFailedError('INSERT', [], {
      code: '23505',
      constraint,
    } as unknown as Error);

  beforeEach(() => {
    repository = {
      insert: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      findOneBy: jest.fn(),
    } as unknown as jest.Mocked<Repository<AuditEntity>>;
    service = new AuditService(repository);
  });

  describe('record', () => {
    it('flattens the event into one row', async () => {
      await expect(service.record(event)).resolves.toBe(true);

      expect(repository.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'event-1',
          service: 'trip-service',
          action: AuditActionEnum.STATUS_CHANGED,
          entityType: AuditEntityTypeEnum.TRIP,
          entityId: 42,
          actorType: AuditActorTypeEnum.USER,
          actorId: 7,
          actorRole: UserRoleEnum.DRIVER,
          changes: event.changes,
        }),
      );
    });

    it('treats an event it already recorded as handled', async () => {
      repository.insert.mockRejectedValue(uniqueViolation(UQ_AUDITS_EVENT_ID));

      await expect(service.record(event)).resolves.toBe(false);
    });

    it('rethrows any other failure so the offset is not committed', async () => {
      repository.insert.mockRejectedValue(new Error('database down'));

      await expect(service.record(event)).rejects.toThrow('database down');
    });
  });

  describe('list', () => {
    it('filters only by what was given', async () => {
      await service.list({ page: 2, limit: 10 });

      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          order: { occurredAt: 'DESC', id: 'DESC' },
          skip: 10,
          take: 10,
        }),
      );
    });

    it('combines entity, actor and service filters', async () => {
      await service.list({
        service: 'auth-service',
        action: AuditActionEnum.UPDATED,
        entityType: AuditEntityTypeEnum.USER,
        entityId: 5,
        actorType: AuditActorTypeEnum.USER,
        actorId: 1,
        actorRole: UserRoleEnum.ADMIN,
        page: 1,
        limit: 20,
      });

      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            service: 'auth-service',
            action: AuditActionEnum.UPDATED,
            entityType: AuditEntityTypeEnum.USER,
            entityId: 5,
            actorType: AuditActorTypeEnum.USER,
            actorId: 1,
            actorRole: UserRoleEnum.ADMIN,
          },
        }),
      );
    });

    it.each([
      [
        'both bounds',
        '2026-10-01T00:00:00Z',
        '2026-10-31T00:00:00Z',
        'between',
      ],
      ['a lower bound', '2026-10-01T00:00:00Z', undefined, 'moreThanOrEqual'],
      ['an upper bound', undefined, '2026-10-31T00:00:00Z', 'lessThanOrEqual'],
    ])(
      'filters occurredAt by %s',
      async (_case, occurredFrom, occurredTo, type) => {
        await service.list({ occurredFrom, occurredTo, page: 1, limit: 20 });

        const [options] = repository.findAndCount.mock.calls[0];

        expect(
          (options?.where as { occurredAt: { type: string } }).occurredAt.type,
        ).toBe(type);
      },
    );
  });

  describe('findOne', () => {
    it('throws when the audit does not exist', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.findOne(9)).rejects.toThrow(NotFoundException);
    });
  });
});
