import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { UQ_NOTIFICATION_PREFERENCES_USER } from '../preferences.constant';

@Entity('notification_preferences')
@Index(UQ_NOTIFICATION_PREFERENCES_USER, ['userId'], { unique: true })
class NotificationPreferenceEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column({ default: true })
  email: boolean;

  @Column({ default: true })
  sms: boolean;

  @Column({ default: true })
  whatsapp: boolean;

  @Column({ default: true })
  push: boolean;

  @Column({ default: true })
  inApp: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

export default NotificationPreferenceEntity;
