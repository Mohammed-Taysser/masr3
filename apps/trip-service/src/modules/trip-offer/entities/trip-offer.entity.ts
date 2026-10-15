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

import { MONEY_COLUMN_OPTIONS } from '@masr3/libs/money';

import TripEntity from '../../trip/entities/trip.entity';
import { UQ_TRIP_OFFERS_PENDING_DRIVER } from '../trip-offer.constant';
import { TripOfferStatusEnum } from '../trip-offer.enum';

@Entity('trip_offers')
@Index(['tripId', 'status'])
@Index(['driverId', 'status'])
// One live offer per driver per trip.
@Index(UQ_TRIP_OFFERS_PENDING_DRIVER, ['tripId', 'driverId'], {
  unique: true,
  where: `"status" = '${TripOfferStatusEnum.PENDING}'`,
})
class TripOfferEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tripId: number;

  @ManyToOne(() => TripEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tripId' })
  trip: TripEntity;

  @Column()
  driverId: number;

  @Column({ ...MONEY_COLUMN_OPTIONS })
  amount: number;

  @Column({ type: 'enum', enum: TripOfferStatusEnum })
  status: TripOfferStatusEnum;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

export default TripOfferEntity;
