// Every business entity a person can act on. Left out on purpose: audits (the
// trail itself), trip_status_history (written with a trip's STATUS_CHANGED),
// drivers (vehicle-service's copy of auth's users) and outbox_events
// (transport, not data).
enum AuditEntityTypeEnum {
  // auth-service
  USER = 'USER',
  // trip-service
  TRIP = 'TRIP',
  TRIP_OFFER = 'TRIP_OFFER',
  // notification-service
  NOTIFICATION = 'NOTIFICATION',
  NOTIFICATION_DELIVERY = 'NOTIFICATION_DELIVERY',
  NOTIFICATION_PREFERENCE = 'NOTIFICATION_PREFERENCE',
  // vehicle-service
  VEHICLE = 'VEHICLE',
}

enum AuditActorTypeEnum {
  USER = 'USER',
  SERVICE = 'SERVICE',
  SYSTEM = 'SYSTEM',
  // A request nobody is signed in for, such as forgot-password.
  ANONYMOUS = 'ANONYMOUS',
}

// Verbs only: the entity is the row's entityType, so the same verb serves every
// entity (TRIP + STATUS_CHANGED, USER + STATUS_CHANGED).
enum AuditActionEnum {
  // Any entity
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  DELETED = 'DELETED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  // USER
  REGISTERED = 'REGISTERED',
  LOGGED_IN = 'LOGGED_IN',
  LOGGED_OUT = 'LOGGED_OUT',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  PASSWORD_RESET_REQUESTED = 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED = 'PASSWORD_RESET_COMPLETED',
  // TRIP_OFFER
  SUBMITTED = 'SUBMITTED',
  WITHDRAWN = 'WITHDRAWN',
}

export { AuditActionEnum, AuditActorTypeEnum, AuditEntityTypeEnum };
