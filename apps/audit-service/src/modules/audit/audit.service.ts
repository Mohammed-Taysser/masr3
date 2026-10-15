import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  FindOperator,
  FindOptionsWhere,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';

import { isUniqueViolation } from '@masr3/libs/database';
import { dayjs } from '@masr3/libs/date';
import { AuditActionRecordedEvent } from '@masr3/libs/kafka';
import { paginate, Paginated, paginationWindow } from '@masr3/libs/pagination';

import { UQ_AUDITS_EVENT_ID } from './audit.constant';
import ListAuditsQueryDto from './dto/list-audits-query.dto';
import AuditEntity from './entities/audit.entity';

@Injectable()
class AuditService {
  constructor(
    @InjectRepository(AuditEntity)
    private readonly auditRepository: Repository<AuditEntity>,
  ) {}

  // Returns false when the event was already recorded: a replay or a
  // redelivery is not an error.
  async record(event: AuditActionRecordedEvent): Promise<boolean> {
    try {
      await this.auditRepository.insert({
        eventId: event.eventId,
        schemaVersion: event.schemaVersion,
        service: event.service,
        action: event.action,
        entityType: event.entity.type,
        entityId: event.entity.id,
        actorType: event.actor.type,
        actorId: event.actor.id,
        actorRole: event.actor.role,
        changes: event.changes,
        metadata: event.metadata,
        occurredAt: dayjs(event.occurredAt).toDate(),
      });
    } catch (error) {
      if (isUniqueViolation(error, UQ_AUDITS_EVENT_ID)) {
        return false;
      }

      throw error;
    }

    return true;
  }

  async list(query: ListAuditsQueryDto): Promise<Paginated<AuditEntity>> {
    const [items, total] = await this.auditRepository.findAndCount({
      where: AuditService.prepareListWhere(query),
      order: { occurredAt: 'DESC', id: 'DESC' },
      ...paginationWindow(query),
    });

    return paginate(items, total, query);
  }

  async findOne(id: number): Promise<AuditEntity> {
    const audit = await this.auditRepository.findOneBy({ id });

    if (!audit) {
      throw new NotFoundException(`Audit ${id} not found`);
    }

    return audit;
  }

  private static prepareListWhere(
    query: ListAuditsQueryDto,
  ): FindOptionsWhere<AuditEntity> {
    const occurredAt = AuditService.occurredBetween(
      query.occurredFrom,
      query.occurredTo,
    );

    return {
      ...(query.service && { service: query.service }),
      ...(query.action && { action: query.action }),
      ...(query.entityType && { entityType: query.entityType }),
      ...(query.entityId && { entityId: query.entityId }),
      ...(query.actorType && { actorType: query.actorType }),
      ...(query.actorId && { actorId: query.actorId }),
      ...(query.actorRole && { actorRole: query.actorRole }),
      ...(occurredAt && { occurredAt }),
    };
  }

  private static occurredBetween(
    from: string | undefined,
    to: string | undefined,
  ): FindOperator<Date> | null {
    if (from && to) {
      return Between(dayjs(from).toDate(), dayjs(to).toDate());
    }

    if (from) {
      return MoreThanOrEqual(dayjs(from).toDate());
    }

    if (to) {
      return LessThanOrEqual(dayjs(to).toDate());
    }

    return null;
  }
}

export default AuditService;
