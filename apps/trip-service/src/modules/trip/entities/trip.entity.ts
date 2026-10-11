import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { decimalTransformer } from '../../../shared/transformers/decimal.transformer';
import {
  CUSTOMER_ACTIVE_TRIP_STATUSES,
  DRIVER_ACTIVE_TRIP_STATUSES,
  FARE_PRECISION,
  FARE_SCALE,
  UQ_TRIPS_ACTIVE_CUSTOMER,
  UQ_TRIPS_ACTIVE_DRIVER,
} from '../trip.constant';
import { TripStatusEnum, TripTypeEnum } from '../trip.enum';

const statusIn = (statuses: readonly TripStatusEnum[]) =>
  `"status" IN (${statuses.map((status) => `'${status}'`).join(', ')})`;

@Entity('trips')
@Index(['status'])
@Index(['customerId'])
@Index(['driverId'])
// One active trip per customer and per driver.
@Index(UQ_TRIPS_ACTIVE_CUSTOMER, ['customerId'], {
  unique: true,
  where: statusIn(CUSTOMER_ACTIVE_TRIP_STATUSES),
})
@Index(UQ_TRIPS_ACTIVE_DRIVER, ['driverId'], {
  unique: true,
  where: statusIn(DRIVER_ACTIVE_TRIP_STATUSES),
})
@Check(
  'CHK_trips_parcel_recipient',
  `"type" <> 'PARCEL' OR ("recipientName" IS NOT NULL AND "recipientPhone" IS NOT NULL)`,
)
class TripEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  customerId: number;

  @Column({ type: 'int', nullable: true })
  driverId: number | null;

  @Column({ type: 'enum', enum: TripTypeEnum })
  type: TripTypeEnum;

  @Column({
    type: 'enum',
    enum: TripStatusEnum,
  })
  status: TripStatusEnum;

  @Column({ type: 'double precision' })
  pickupLatitude: number;

  @Column({ type: 'double precision' })
  pickupLongitude: number;

  @Column()
  pickupAddress: string;

  @Column({ type: 'double precision' })
  dropoffLatitude: number;

  @Column({ type: 'double precision' })
  dropoffLongitude: number;

  @Column()
  dropoffAddress: string;

  @Column({
    type: 'decimal',
    precision: FARE_PRECISION,
    scale: FARE_SCALE,
    transformer: decimalTransformer,
  })
  proposedFare: number;

  @Column({
    type: 'decimal',
    precision: FARE_PRECISION,
    scale: FARE_SCALE,
    nullable: true,
    transformer: decimalTransformer,
  })
  agreedFare: number | null;

  @Column({ type: 'varchar', nullable: true })
  recipientName: string | null;

  @Column({ type: 'varchar', nullable: true })
  recipientPhone: string | null;

  @Column({ type: 'varchar', nullable: true })
  packageDescription: string | null;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export default TripEntity;
