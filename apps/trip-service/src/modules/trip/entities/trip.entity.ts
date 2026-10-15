import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { TripStatusEnum, TripTypeEnum } from '@masr3/libs/kafka';
import { MONEY_COLUMN_OPTIONS } from '@masr3/libs/money';

import {
  CUSTOMER_ACTIVE_TRIP_STATUSES,
  DRIVER_ACTIVE_TRIP_STATUSES,
  UQ_TRIPS_ACTIVE_CUSTOMER,
  UQ_TRIPS_ACTIVE_DRIVER,
} from '../trip.constant';

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

  @Column({ ...MONEY_COLUMN_OPTIONS })
  proposedFare: number;

  @Column({ ...MONEY_COLUMN_OPTIONS, nullable: true })
  agreedFare: number | null;

  @Column({ type: 'varchar', nullable: true })
  recipientName: string | null;

  @Column({ type: 'varchar', nullable: true })
  recipientPhone: string | null;

  @Column({ type: 'varchar', nullable: true })
  packageDescription: string | null;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

export default TripEntity;
