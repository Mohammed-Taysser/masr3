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

import DriverEntity from '../../driver/entities/driver.entity';
import {
  UQ_VEHICLES_DRIVER_DEFAULT,
  UQ_VEHICLES_PLATE_NUMBER,
} from '../vehicle.constant';
import {
  VehicleOperationalStatusEnum,
  VehicleTypeEnum,
  VehicleVerificationStatusEnum,
} from '../vehicle.enum';

@Entity('vehicles')
@Index(['driverId'])
@Index(UQ_VEHICLES_PLATE_NUMBER, ['plateNumber'], { unique: true })
@Index(UQ_VEHICLES_DRIVER_DEFAULT, ['driverId'], {
  unique: true,
  where: '"isDefault" = true',
})
class VehicleEntity {
  @PrimaryGeneratedColumn()
  id: number;

  // auth-service's user id.
  @Column({ type: 'int' })
  driverId: number;

  // No foreign key: drivers is a copy fed by Kafka, and may briefly lag
  // behind, or lose a row whose user stopped being a driver.
  @ManyToOne(() => DriverEntity, {
    createForeignKeyConstraints: false,
    nullable: true,
  })
  @JoinColumn({ name: 'driverId', referencedColumnName: 'userId' })
  driver: DriverEntity | null;

  @Column({ type: 'enum', enum: VehicleTypeEnum })
  type: VehicleTypeEnum;

  @Column({ type: 'varchar' })
  manufacturer: string;

  @Column({ type: 'varchar' })
  model: string;

  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'varchar' })
  plateNumber: string;

  @Column({ type: 'varchar', nullable: true })
  color: string | null;

  @Column({
    type: 'enum',
    enum: VehicleVerificationStatusEnum,
    default: VehicleVerificationStatusEnum.PENDING,
  })
  verificationStatus: VehicleVerificationStatusEnum;

  @Column({
    type: 'enum',
    enum: VehicleOperationalStatusEnum,
    default: VehicleOperationalStatusEnum.INACTIVE,
  })
  operationalStatus: VehicleOperationalStatusEnum;

  @Column({ type: 'bool', default: false })
  isDefault: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

export default VehicleEntity;
