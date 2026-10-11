import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { TripActorEnum, TripStatusEnum } from '../trip.enum';
import TripEntity from './trip.entity';

@Entity('trip_status_history')
@Index(['tripId', 'createdAt'])
class TripStatusHistoryEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tripId: number;

  @ManyToOne(() => TripEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tripId' })
  trip: TripEntity;

  @Column({
    type: 'enum',
    enum: TripStatusEnum,
    nullable: true,
  })
  fromStatus: TripStatusEnum | null;

  @Column({
    type: 'enum',
    enum: TripStatusEnum,
  })
  toStatus: TripStatusEnum;

  @Column({ type: 'enum', enum: TripActorEnum })
  actor: TripActorEnum;

  // Null when actor is SYSTEM.
  @Column({ type: 'int', nullable: true })
  actorId: number | null;

  @Column({ type: 'varchar', nullable: true })
  reason: string | null;

  @CreateDateColumn()
  createdAt: Date;
}

export default TripStatusHistoryEntity;
