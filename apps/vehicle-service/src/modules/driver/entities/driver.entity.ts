import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { UQ_DRIVERS_USER_ID } from '../driver.constant';

// vehicle-service's copy of auth-service's DRIVER users, kept current from
// auth.user-changed. auth-service owns the data; nothing here writes it
// except the consumer.
@Entity('drivers')
@Index(UQ_DRIVERS_USER_ID, ['userId'], { unique: true })
class DriverEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  userId: number;

  @Column({ type: 'varchar' })
  firstName: string;

  @Column({ type: 'varchar' })
  lastName: string;

  @Column({ type: 'bool' })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

export default DriverEntity;
