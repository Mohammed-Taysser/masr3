import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { UQ_NOTIFICATIONS_DEDUPE_KEY } from '../notification.constant';
import {
  NotificationCategoryEnum,
  NotificationTypeEnum,
} from '../notification.enum';
import { EmailAttachment } from '../notification.interface';
import NotificationDeliveryEntity from './notification-delivery.entity';

@Entity('notifications')
@Index(UQ_NOTIFICATIONS_DEDUPE_KEY, ['dedupeKey'], { unique: true })
@Index(['userId', 'inboxAt'])
@Index(['createdAt'])
class NotificationEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: NotificationTypeEnum })
  type: NotificationTypeEnum;

  @Column({ type: 'enum', enum: NotificationCategoryEnum })
  category: NotificationCategoryEnum;

  @Column()
  userId: number;

  @Column()
  dedupeKey: string;

  @Column({ type: 'jsonb' })
  data: object;

  @Column({ type: 'jsonb', nullable: true })
  attachments: EmailAttachment[] | null;

  @Column()
  locale: string;

  @Column({ type: 'varchar', nullable: true })
  recipientName: string | null;

  @Column({ type: 'varchar', nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ type: 'varchar', nullable: true })
  deepLink: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  inboxAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  archivedAt: Date | null;

  @OneToMany(
    () => NotificationDeliveryEntity,
    (delivery) => delivery.notification,
  )
  deliveries: NotificationDeliveryEntity[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

export default NotificationEntity;
