import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { UserRoleEnum } from '@masr3/libs/auth';

import { UQ_USERS_USER_ID } from '../user.constant';

// trip-service's copy of auth-service's CUSTOMER and DRIVER users, kept current
// from auth.user-changed. It lets an admin act for a user only when that user
// exists, has the right role and is active. Nothing but the consumer writes it.
@Entity('users')
@Index(UQ_USERS_USER_ID, ['userId'], { unique: true })
class UserEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  userId: number;

  @Column({ type: 'enum', enum: UserRoleEnum })
  role: UserRoleEnum;

  @Column({ type: 'bool' })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

export default UserEntity;
