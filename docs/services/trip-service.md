# trip-service

Owns trips, rides and parcels, from request to completion, in the inDrive style: the customer
proposes a fare, drivers accept it or counter-offer, and the customer picks one offer.

- **Port** 7002, database `trip-db` (41002), Swagger at `http://localhost:7002/api/docs`.
- **Owns:** trips, their status history, offers, and the outbox of trip and audit events.
- **Does not own:** users (auth-service) or messages to people (notification-service). It keeps
  a copy of each CUSTOMER and DRIVER (`userId`, `role`, `isActive`) from `auth.user-changed`,
  used only to check a user an admin names.

## Context

```mermaid
flowchart LR
  customer([Customer app]) -->|HTTP + access token| trip[trip-service :7002]
  driver([Driver app]) -->|HTTP + access token| trip
  admin([Admin console]) -->|HTTP + access token| trip
  users{{auth.user-changed}} -->|group trip-service, from the beginning| trip
  trip -->|verify tokens locally| jwks[auth-service JWKS]
  trip -->|via pgbouncer :41500| db[(trip-db)]
  trip -->|BullMQ jobs| redis[(Redis :44000)]
  trip -->|outbox relay| topic{{trip.status-changed}}
  topic -->|trip emails| notification[notification-service]
  trip -->|outbox relay| audit{{audit.action-recorded}}
  audit -->|audit trail| auditService[audit-service]
```

## Data model

```mermaid
erDiagram
  trips ||--o{ trip_status_history : "records every change"
  trips ||--o{ trip_offers : "receives"
  trips {
    int id PK
    int customerId
    int driverId "null until accepted"
    enum type "RIDE or PARCEL"
    enum status
    double pickupLatitude
    double pickupLongitude
    string pickupAddress
    double dropoffLatitude
    double dropoffLongitude
    string dropoffAddress
    decimal proposedFare "set by the customer"
    decimal agreedFare "set on accept"
    string recipientName "PARCEL only"
    string recipientPhone "PARCEL only"
    string packageDescription
    enum requestedVehicleType "null = any type"
    timestamptz expiresAt
  }
  trip_status_history {
    int id PK
    int tripId FK
    enum fromStatus "null on creation"
    enum toStatus
    enum actor "CUSTOMER DRIVER ADMIN SYSTEM"
    int actorId "null for SYSTEM"
    string reason
    timestamptz createdAt
  }
  trip_offers {
    int id PK
    int tripId FK
    int driverId
    decimal amount
    enum status
  }
  users {
    int id PK
    int userId UK "auth-service user id"
    enum role "CUSTOMER or DRIVER"
    bool isActive
  }
  outbox_events {
    int id PK
    uuid eventId UK
    string topic
    string key "tripId, or TRIP-id / TRIP_OFFER-id for audit"
    jsonb payload
    int attempts
    string lastError
    timestamptz publishedAt "null while pending"
  }
```

- **One active trip each:** partial unique indexes `UQ_trips_active_customer` (REQUESTED,
  ACCEPTED, DRIVER_ARRIVED, IN_PROGRESS) and `UQ_trips_active_driver` (ACCEPTED, DRIVER_ARRIVED,
  IN_PROGRESS). A `23505` on either becomes a `409` naming who is double-booked.
- **One live offer per driver per trip:** `UQ_trip_offers_pending_driver`, unique
  `(tripId, driverId) WHERE status = 'PENDING'`.
- **A parcel names its recipient:** `CHK_trips_parcel_recipient`.
- **Money** is `decimal(10, 2)` in EGP (`TRIP_CURRENCY`), declared with `MONEY_COLUMN_OPTIONS`
  and validated with `@IsMoney()`, both from `@masr3/libs`. `decimalTransformer` reads pg's
  strings back as numbers; round to 2 decimals after any arithmetic.
- **History is the only record of when and who.** `trips` keeps no `acceptedAt` or
  `completedAt`: "completed at" is the `createdAt` of the COMPLETED history row.
  `TripActorEnum` belongs to this service; `SYSTEM` (expiry) is not a user role.

## Trip lifecycle

```mermaid
stateDiagram-v2
  [*] --> REQUESTED: customer, or admin for them
  REQUESTED --> ACCEPTED: customer or admin accepts an offer
  REQUESTED --> EXPIRED: SYSTEM, at expiresAt
  REQUESTED --> CANCELLED: customer or admin
  ACCEPTED --> DRIVER_ARRIVED: assigned driver or admin
  ACCEPTED --> CANCELLED: customer, driver or admin
  DRIVER_ARRIVED --> IN_PROGRESS: assigned driver or admin
  DRIVER_ARRIVED --> CANCELLED: customer, driver or admin
  IN_PROGRESS --> COMPLETED: assigned driver or admin
  COMPLETED --> [*]
  CANCELLED --> [*]
  EXPIRED --> [*]
```

The table is `TRIP_TRANSITIONS` (`trip.constant.ts`). `assertTransitionAllowed`
(`trip.policy.ts`) applies it, and `TripService.transition` is the only way a status changes.
User routes go through `TripService.transitionAs(id, to, user)`, which takes the actor from the
caller's role, so an admin makes a move as `ADMIN` on behalf of the customer or driver.
The policy answers, in this order:

1. `404` when it is not the actor's trip (ownership first, so strangers learn nothing).
2. `409` when that move does not exist from the current status.
3. `403` when the move exists but the actor's role may not make it.

## Offer lifecycle

```mermaid
stateDiagram-v2
  [*] --> PENDING: driver, or admin for them, offers
  PENDING --> WITHDRAWN: driver or admin withdraws
  PENDING --> ACCEPTED: customer or admin accepts this offer
  PENDING --> REJECTED: trip accepted with another offer, or cancelled
  PENDING --> EXPIRED: trip expired
  ACCEPTED --> [*]
  REJECTED --> [*]
  WITHDRAWN --> [*]
  EXPIRED --> [*]
```

**Invariant: no PENDING offer outlives its trip's REQUESTED status.**
`TripService.applyTransition` closes them all whenever a trip leaves REQUESTED.

## Flows

### Request a trip

```mermaid
sequenceDiagram
  actor C as Customer or admin
  participant API as TripController
  participant S as TripService
  participant U as users copy
  participant DB as trip-db
  participant Q as BullMQ trip-expiry
  C->>API: POST /trips
  API->>S: create(dto, user)
  S->>S: resolveTargetUserId (400 admin without customerId, 403 someone else's)
  opt an admin named the customer
    S->>U: findActiveOrFail(customerId, CUSTOMER) (404, 409)
  end
  S->>DB: BEGIN
  S->>DB: INSERT trips (REQUESTED, expiresAt = now + TRIP_REQUEST_TTL_MS)
  S->>DB: INSERT trip_status_history (null to REQUESTED)
  S->>DB: INSERT outbox_events (trip.status-changed)
  S->>DB: INSERT outbox_events (audit TRIP CREATED)
  S->>DB: COMMIT
  S-)Q: add EXPIRE_TRIP, jobId trip-id, delay until expiresAt
  S-->>C: 201 trip
```

- A second active trip for the same customer hits `UQ_trips_active_customer`: `409`.
- History, event and audit carry the caller as actor: `CUSTOMER`, or `ADMIN` with the admin's id
  when an admin booked for the customer.
- A customer booking for themselves is not looked up in the users copy: the token already
  proves who they are, and the copy may lag a brand-new account.
- `requestedVehicleType` (optional) asks for one vehicle type; null accepts any.
- The expiry job is queued after the commit and not awaited. If Redis is down the request
  still succeeds, and the SWEEP job expires the trip instead.

### Make an offer, then accept one

```mermaid
sequenceDiagram
  actor D as Driver
  actor C as Customer
  participant O as TripOfferService
  participant S as TripService
  participant DB as trip-db
  D->>O: POST /trips/:id/offers { amount }
  O->>DB: SELECT trip FOR SHARE
  O->>DB: INSERT trip_offers (PENDING)
  O->>DB: INSERT outbox_events (audit TRIP_OFFER SUBMITTED)
  O-->>D: 201 offer
  C->>O: POST /trips/:id/offers/:offerId/accept
  O->>S: transition(ACCEPTED, acceptedOfferId)
  S->>DB: SELECT trip FOR UPDATE
  S->>S: assertTransitionAllowed
  S->>DB: UPDATE trips (ACCEPTED, driverId, agreedFare)
  S->>DB: UPDATE offers (chosen ACCEPTED, others REJECTED)
  S->>DB: INSERT history + outbox rows (status event, audit)
  S-->>C: 200 trip
```

- **Offers** lock the trip `FOR SHARE`: offers on one trip don't block each other, but wait for
  an acceptance in progress. `409` when the trip is not REQUESTED, has expired, or the driver
  already has an active trip. An `amount` equal to `proposedFare` means "I'll take it as is".
- **Lock order is always trip, then offers**, in both flows, so they cannot deadlock.
- Offers are their own module (`modules/trip-offer/`). Accepting one is a trip transition, so
  `TripOfferService` calls `TripService`, and `TripService` closes the other offers in the same
  transaction.
- **Withdrawing** locks the offer `FOR UPDATE`, checks `canWithdrawOffer` (its driver, or an
  admin) then `assertOfferPending`, marks it WITHDRAWN and writes a `TRIP_OFFER` `WITHDRAWN`
  audit row, in one transaction.
- **Accepting** loads the offer with its trip and checks `canManageTripOffers` (the trip's
  customer, or an admin) before its status, so a stranger gets `404` whatever the offer's state. Two concurrent accepts: one wins, the other gets `409`. If the
  offer was withdrawn a moment earlier, the whole acceptance rolls back with `409`.
- **Admins** make an offer for the driver in `driverId` (checked against the users copy),
  accept for the customer, and withdraw for the driver; each is audited as the admin. The checks
  live in `trip-offer.policy.ts`.
- **Privacy:** drivers browsing open trips (`GET /trips/open`, or `GET /trips/:id` while
  REQUESTED) never see a parcel recipient's name or phone.

### Change the requested vehicle type

```mermaid
sequenceDiagram
  actor U as Customer or admin
  participant S as TripService
  participant DB as trip-db
  U->>S: PATCH /trips/:id/vehicle-type { requestedVehicleType }
  S->>DB: BEGIN, SELECT trip FOR UPDATE
  S->>S: isTripParticipant (404)
  S->>DB: any PENDING offer?
  S->>S: assertRequestedVehicleTypeChangeAllowed (409)
  alt same type as now
    S-->>U: 200 trip, nothing written
  else
    S->>DB: UPDATE trips SET requestedVehicleType
    S->>DB: INSERT outbox_events (audit TRIP UPDATED)
    S->>DB: COMMIT
    S-->>U: 200 trip
  end
```

- Allowed only while the trip is REQUESTED, unexpired and has no pending offer: drivers offer on
  the type the trip asks for. Withdrawn and rejected offers don't block it.
- `null` accepts any vehicle type. The key itself is required, so a missing body is a `400`.

### Lists

One `TripService.list(query, user, scope)` serves three routes, with filters in
`prepareListWhere`:

| Route             | Roles            | Scope (`TripListScopeEnum`) | Rows                                               |
| ----------------- | ---------------- | --------------------------- | -------------------------------------------------- |
| `GET /trips`      | ADMIN            | `ALL`                       | every trip                                         |
| `GET /trips/me`   | CUSTOMER, DRIVER | `MINE`                      | a customer's requests, a driver's assigned trips   |
| `GET /trips/open` | DRIVER, ADMIN    | `OPEN`                      | REQUESTED and unexpired, without recipient details |

Filters: `status`, `type`, `requestedVehicleType`, `customerId`, `driverId`. `MINE` pins the
caller's own side over any id in the query; `OPEN` pins the status.

### Run, cancel and every other status change

```mermaid
sequenceDiagram
  actor U as Customer, driver or admin
  participant S as TripService.transition
  participant DB as trip-db
  U->>S: arrived, start, complete or cancel
  S->>DB: BEGIN
  S->>DB: SELECT trip FOR UPDATE
  S->>S: assertTransitionAllowed (404, 409, 403)
  S->>DB: UPDATE trips SET status
  S->>DB: close PENDING offers if leaving REQUESTED
  S->>DB: INSERT trip_status_history
  S->>DB: INSERT outbox_events (trip.status-changed)
  S->>DB: INSERT outbox_events (audit TRIP STATUS_CHANGED, before/after diff)
  S->>DB: COMMIT
  S-->>U: 200 trip
```

- A second concurrent caller waits on the row lock, then validates against the status the
  first one wrote, and gets a precise `409`. Verified with 20 concurrent cancel-vs-expire races.
- **Why not a guarded `UPDATE … WHERE status IN (…)`:** `RETURNING` gives only the new values,
  so `fromStatus` would be unknown, and `affected = 0` can't tell "not found", "not yours",
  "wrong status" and "lost the race" apart.
- The lock lives only inside the transaction, so it is safe under pgbouncer's `transaction`
  mode.

### Expiry

```mermaid
sequenceDiagram
  participant Q as BullMQ trip-expiry
  participant P as TripExpiryProcessor
  participant E as TripExpiryService
  participant S as TripService.transition
  Q->>P: EXPIRE_TRIP (delayed until expiresAt)
  P->>E: expire(tripId)
  E->>S: transition(EXPIRED, actor SYSTEM)
  Note over S: does nothing unless still REQUESTED and past expiresAt
  Q->>P: SWEEP (job scheduler, every TRIP_EXPIRY_SWEEP_INTERVAL_MS)
  P->>E: expireDueTrips()
  E->>S: expire up to TRIP_EXPIRY_BATCH_SIZE overdue trips
```

- The SWEEP catches trips whose delayed job was never queued (Redis down at creation).
- Both paths go through `transition`, so they can run on several instances at once without
  double-processing. A job that fires early does nothing.
- Accepting an offer on a trip past its deadline answers `409` "The trip request has expired".

### Publishing events (transactional outbox)

```mermaid
sequenceDiagram
  participant Q as BullMQ trip-outbox-relay
  participant R as OutboxRelayService (libs)
  participant DB as trip-db
  participant K as Kafka
  Q->>R: RELAY (job scheduler, every OUTBOX_POLL_INTERVAL_MS)
  R->>DB: BEGIN, pg_try_advisory_xact_lock
  alt another instance holds the lock
    R->>R: return, that instance is relaying
  else lock taken
    R->>DB: SELECT up to OUTBOX_BATCH_SIZE pending rows ORDER BY id
    R->>K: send batch, each row with its own topic and key
    alt Kafka accepted
      R->>DB: SET publishedAt
    else Kafka failed
      R->>DB: attempts + 1, lastError
    end
    R->>DB: DELETE published rows older than OUTBOX_RETENTION_MS
    R->>DB: COMMIT
  end
```

The outbox is the shared one from `@masr3/libs` (`OutboxModule.forRoot` in `AppModule`), on
queue `trip-outbox-relay` (`TRIP_OUTBOX_RELAY_QUEUE`) with lock id `7002001` (env
`OUTBOX_RELAY_LOCK_ID`).
The pattern (why, guarantees, costs) is in
[`docs/patterns/transactional-outbox.md`](../patterns/transactional-outbox.md). Pending or
failing events: `SELECT * FROM outbox_events WHERE "publishedAt" IS NULL ORDER BY id`.

## Events

| Topic                   | Key                            | Contract                                                 | Consumers                          |
| ----------------------- | ------------------------------ | -------------------------------------------------------- | ---------------------------------- |
| `trip.status-changed`   | `tripId`                       | `TripStatusChangedEvent` (`libs/src/lib/kafka/trip/`)    | notification-service (trip emails) |
| `audit.action-recorded` | `TRIP-<id>`, `TRIP_OFFER-<id>` | `AuditActionRecordedEvent` (`libs/src/lib/kafka/audit/`) | audit-service                      |

Consumed: `auth.user-changed` (group `trip-service`, from the beginning, `KafkaConsumerService`),
applied by `UserService.applyUserChanged` as an upsert or delete. ADMIN users and deleted users
are not kept. Malformed messages are skipped (`UserChangedEventDto`).

- **One topic for every status change.** Kafka orders messages only within a partition, so
  per-status topics could deliver "cancelled" before "accepted". Consumers filter on
  `toStatus`.
- The payload carries `tripId`, `type`, `customerId`, `driverId`, `fromStatus` (null on
  creation), `toStatus`, `actor`, `actorId`, `reason`, `proposedFare`, `requestedVehicleType`
  and `agreedFare`, plus
  `eventId` and `occurredAt`.
- It also carries `pickupAddress`, `dropoffAddress` and `currency`, so a consumer can describe
  the trip ("Tahrir Square → Zamalek, EGP 95.00") without calling trip-service.
- Offers have no domain topic. Acceptance already emits REQUESTED → ACCEPTED.
- **Audit events** go through the same outbox, in the same transaction as the change
  (`AuditRecorderService` in `modules/audit/`): `TRIP` `CREATED`, `STATUS_CHANGED` and
  `UPDATED` (vehicle type), `TRIP_OFFER` `SUBMITTED` and `WITHDRAWN`. `changes` is `buildAuditChanges(before, after, TRIP_AUDITED_FIELDS)`.
  The allow-list leaves the parcel recipient's name and phone out. The actor keeps its role
  (`TRIP_ACTOR_TO_ROLE`, applied by `TripService.auditActorFor`); SYSTEM expiry is a SYSTEM
  actor. See
  [audit-service](audit-service.md).

## Authentication

Routes need a user access token, verified locally against auth-service's JWKS with the shared
guard from `@masr3/libs` (see [`docs/authentication.md`](../authentication.md)). Roles are
checked by `@Roles(...)`; ownership, assigned-driver and admin-acting-for checks are pure
functions in `trip.policy.ts` and `trip-offer.policy.ts`. Route by route:
[`docs/permissions.md`](../permissions.md#trip-service). A
logged-out or re-roled user's access token keeps working here until it expires, at most 5
minutes.

## Planned

- **Live location, built and parked** on branch `wip/live-location` (not on `main`). It has
  Socket.IO on `/live` with handshake auth, driver positions in Redis GEO, new-trip alerts to
  nearby drivers, live trip following with distances, nearby open trips with PostGIS, trip
  locations buffered in Redis and written in batches, and correlation IDs. Resume from that
  branch; its commit message says how to restore the env and database.
- **Routing and ETA:** a routing engine (OSRM) for driving distance, ETA and fare suggestions.
  It builds on live location.
- **Ratings** after a completed trip, **driver profiles**, **payments**. Vehicles exist in
  [vehicle-service](vehicle-service.md); trips don't reference them yet.
- **Display names:** trip-service knows users only by id; names and car details come from
  events or auth-service.
