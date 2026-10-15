enum VehicleTypeEnum {
  MOTORCYCLE = 'MOTORCYCLE',
  CAR = 'CAR',
  VAN = 'VAN',
  TRUCK = 'TRUCK',
  BICYCLE = 'BICYCLE',
}

enum VehicleVerificationStatusEnum {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

enum VehicleOperationalStatusEnum {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export {
  VehicleOperationalStatusEnum,
  VehicleTypeEnum,
  VehicleVerificationStatusEnum,
};
