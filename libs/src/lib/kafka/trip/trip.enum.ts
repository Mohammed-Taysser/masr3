enum TripTypeEnum {
  RIDE = 'RIDE',
  PARCEL = 'PARCEL',
}

enum TripStatusEnum {
  REQUESTED = 'REQUESTED',
  ACCEPTED = 'ACCEPTED',
  DRIVER_ARRIVED = 'DRIVER_ARRIVED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

enum TripActorEnum {
  CUSTOMER = 'CUSTOMER',
  DRIVER = 'DRIVER',
  ADMIN = 'ADMIN',
  SYSTEM = 'SYSTEM',
}

export { TripTypeEnum, TripStatusEnum, TripActorEnum };
