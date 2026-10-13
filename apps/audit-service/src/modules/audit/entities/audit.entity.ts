import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import {
  AuditActionEnum,
  AuditActorTypeEnum,
  AuditChanges,
  AuditEntityTypeEnum,
  UserRoleEnum,
} from '@masr3/libs';

import { UQ_AUDITS_EVENT_ID } from '../audit.constant';

@Entity('audits')
@Index(UQ_AUDITS_EVENT_ID, ['eventId'], { unique: true })
@Index(['entityType', 'entityId', 'occurredAt'])
@Index(['actorId', 'occurredAt'])
@Index(['service', 'occurredAt'])
@Index(['action', 'occurredAt'])
class AuditEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  eventId: string;

  @Column({ type: 'int' })
  schemaVersion: number;

  @Column({ type: 'varchar' })
  service: string;

  @Column({ type: 'varchar' })
  action: AuditActionEnum;

  @Column({ type: 'varchar' })
  entityType: AuditEntityTypeEnum;

  @Column({ type: 'int' })
  entityId: number;

  @Column({ type: 'varchar' })
  actorType: AuditActorTypeEnum;

  @Column({ type: 'int', nullable: true })
  actorId: number | null;

  @Column({ type: 'varchar', nullable: true })
  actorRole: UserRoleEnum | null;

  @Column({ type: 'jsonb', nullable: true })
  changes: AuditChanges | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'timestamptz' })
  occurredAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

export default AuditEntity;
