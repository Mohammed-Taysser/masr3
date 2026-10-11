import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import {
  NotificationChannelEnum,
  NotificationStatusEnum,
} from '../notification.enum';

@Entity('notifications')
@Index(['createdAt'])
@Index(['status'])
@Index(['recipient'])
class NotificationEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', nullable: true, unique: true })
  eventId: string | null;

  @Column({ type: 'enum', enum: NotificationChannelEnum })
  channel: NotificationChannelEnum;

  @Column()
  recipient: string;

  @Column()
  template: string;

  @Column()
  subject: string;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ type: 'enum', enum: NotificationStatusEnum })
  status: NotificationStatusEnum;

  @Column({ type: 'varchar', nullable: true })
  error: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

export default NotificationEntity;
