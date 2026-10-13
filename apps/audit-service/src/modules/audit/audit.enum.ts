enum AuditActorType {
  USER = 'USER',
  SERVICE = 'SERVICE',
  SYSTEM = 'SYSTEM',
}

enum AuditEntityType {
  USER = 'USER',
  TRIP = 'TRIP',
  TRIP_OFFER = 'TRIP_OFFER',
}

enum AuditService {
  AUTH = 'auth-service',
  USER = 'user-service',
  TRIP = 'trip-service',
  AUDIT = 'audit-service',
}

export { AuditService, AuditEntityType, AuditActorType };
