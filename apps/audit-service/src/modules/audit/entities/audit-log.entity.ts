import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AuditActorType, AuditEntityType, AuditService } from '../audit.enum';

@Entity('audit_log')
@Index(['entityType', 'entityId', 'occurredAt'])
@Index(['actorId', 'occurredAt'])
@Index(['service', 'occurredAt'])
class AuditLogEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', default: 1 })
  schemaVersion: number;

  @Column({ type: 'varchar' })
  service: AuditService;

  @Column()
  action: string;

  @Column({ type: 'varchar' })
  entityType: AuditEntityType;

  @Column()
  entityId: string;

  @Column({ type: 'varchar' })
  actorType: AuditActorType;

  @Column({ nullable: true })
  actorId: string | null;

  @Column('jsonb', { nullable: true })
  changes: Record<string, unknown> | null;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'timestamptz' })
  occurredAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

export default AuditLogEntity;
