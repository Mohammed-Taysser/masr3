import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { UQ_NOTIFICATION_DELIVERIES_CHANNEL } from '../notification.constant';
import {
  DeliverySkipReasonEnum,
  DeliveryStatusEnum,
  NotificationChannelEnum,
} from '../notification.enum';
import NotificationEntity from './notification.entity';

// One row per channel of a notification, including channels that could not be
// used: a SKIPPED row with its reason, so nothing disappears silently.
@Entity('notification_deliveries')
@Index(UQ_NOTIFICATION_DELIVERIES_CHANNEL, ['notificationId', 'channel'], {
  unique: true,
})
@Index(['status', 'createdAt'])
class NotificationDeliveryEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  notificationId: number;

  @ManyToOne(
    () => NotificationEntity,
    (notification) => notification.deliveries,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'notificationId' })
  notification: NotificationEntity;

  @Column({ type: 'enum', enum: NotificationChannelEnum })
  channel: NotificationChannelEnum;

  @Column({ type: 'varchar', nullable: true })
  address: string | null;

  @Column({ type: 'enum', enum: DeliveryStatusEnum })
  status: DeliveryStatusEnum;

  @Column({ type: 'enum', enum: DeliverySkipReasonEnum, nullable: true })
  skipReason: DeliverySkipReasonEnum | null;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'varchar', nullable: true })
  providerMessageId: string | null;

  @Column({ type: 'varchar', nullable: true })
  subject: string | null;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

export default NotificationDeliveryEntity;
