import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// The same table in every service that publishes through an outbox; each
// lists this entity in its DataSource and owns its own migration.
@Entity('outbox_events')
@Index(['publishedAt', 'id'])
class OutboxEventEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  eventId!: string;

  @Column()
  topic!: string;

  @Column()
  key!: string;

  @Column({ type: 'jsonb' })
  payload!: object;

  @Column({ default: 0 })
  attempts!: number;

  @Column({ type: 'varchar', nullable: true })
  lastError!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

export default OutboxEventEntity;
