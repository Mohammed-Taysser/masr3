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

import { decimalTransformer } from '../../../shared/transformers/decimal.transformer';
import {
  FARE_PRECISION,
  FARE_SCALE,
  UQ_TRIP_OFFERS_PENDING_DRIVER,
} from '../trip.constant';
import { TripOfferStatusEnum } from '../trip.enum';
import TripEntity from './trip.entity';

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

  @Column({
    type: 'decimal',
    precision: FARE_PRECISION,
    scale: FARE_SCALE,
    transformer: decimalTransformer,
  })
  amount: number;

  @Column({ type: 'enum', enum: TripOfferStatusEnum })
  status: TripOfferStatusEnum;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

export default TripOfferEntity;
