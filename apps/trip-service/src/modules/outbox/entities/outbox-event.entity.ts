import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('outbox_events')
@Index(['publishedAt', 'id'])
class OutboxEventEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  eventId: string;

  @Column()
  topic: string;

  @Column()
  key: string;

  @Column({ type: 'jsonb' })
  payload: object;

  @Column({ default: 0 })
  attempts: number;

  @Column({ type: 'varchar', nullable: true })
  lastError: string | null;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}

export default OutboxEventEntity;
