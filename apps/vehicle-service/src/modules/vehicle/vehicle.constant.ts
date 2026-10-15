import type VehicleEntity from './entities/vehicle.entity';
import {
  VehicleOperationalStatusEnum,
  VehicleVerificationStatusEnum,
} from './vehicle.enum';

const UQ_VEHICLES_PLATE_NUMBER = 'UQ_vehicles_plate_number';
// At most one default vehicle per driver.
const UQ_VEHICLES_DRIVER_DEFAULT = 'UQ_vehicles_driver_default';

const VEHICLE_MINIMUM_YEAR = 1980;
const VEHICLE_NAME_MAX_LENGTH = 100;
const VEHICLE_PLATE_NUMBER_MAX_LENGTH = 20;
const VEHICLE_COLOR_MAX_LENGTH = 50;
const VEHICLE_STATUS_REASON_MAX_LENGTH = 500;

// Every vehicle column an audit diff contains.
const VEHICLE_AUDITED_FIELDS: readonly (keyof VehicleEntity & string)[] = [
  'driverId',
  'type',
  'manufacturer',
  'model',
  'year',
  'plateNumber',
  'color',
  'verificationStatus',
  'operationalStatus',
  'isDefault',
];

// From each status, the statuses an admin may move a vehicle to.
const VEHICLE_VERIFICATION_TRANSITIONS: Readonly<
  Record<
    VehicleVerificationStatusEnum,
    readonly VehicleVerificationStatusEnum[]
  >
> = {
  [VehicleVerificationStatusEnum.PENDING]: [
    VehicleVerificationStatusEnum.APPROVED,
    VehicleVerificationStatusEnum.REJECTED,
  ],
  [VehicleVerificationStatusEnum.APPROVED]: [
    VehicleVerificationStatusEnum.REJECTED,
  ],
  [VehicleVerificationStatusEnum.REJECTED]: [
    VehicleVerificationStatusEnum.PENDING,
  ],
};

const VEHICLE_OPERATIONAL_TRANSITIONS: Readonly<
  Record<VehicleOperationalStatusEnum, readonly VehicleOperationalStatusEnum[]>
> = {
  [VehicleOperationalStatusEnum.INACTIVE]: [
    VehicleOperationalStatusEnum.ACTIVE,
    VehicleOperationalStatusEnum.SUSPENDED,
  ],
  [VehicleOperationalStatusEnum.ACTIVE]: [
    VehicleOperationalStatusEnum.INACTIVE,
    VehicleOperationalStatusEnum.SUSPENDED,
  ],
  [VehicleOperationalStatusEnum.SUSPENDED]: [
    VehicleOperationalStatusEnum.INACTIVE,
  ],
};

export {
  UQ_VEHICLES_DRIVER_DEFAULT,
  UQ_VEHICLES_PLATE_NUMBER,
  VEHICLE_AUDITED_FIELDS,
  VEHICLE_COLOR_MAX_LENGTH,
  VEHICLE_MINIMUM_YEAR,
  VEHICLE_NAME_MAX_LENGTH,
  VEHICLE_OPERATIONAL_TRANSITIONS,
  VEHICLE_PLATE_NUMBER_MAX_LENGTH,
  VEHICLE_STATUS_REASON_MAX_LENGTH,
  VEHICLE_VERIFICATION_TRANSITIONS,
};
