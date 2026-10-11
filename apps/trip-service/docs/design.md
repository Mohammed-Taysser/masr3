# trip-service — design

masr3 moves people (rides) and things (parcels) in the inDrive style: the customer proposes a
fare, drivers accept it or counter-offer, and the customer picks one offer. trip-service owns the
trip from request to completion.

**What exists today:**

- the domain core
- the trip API, with bidding and trip execution
- the transactional outbox

Sections marked **Built** describe the code. Live location, expiry and notifications are still
planned. Each one is the starting point for its own plan, and moves into the README once it is
built.

## Domain

### Lifecycle

```text
REQUESTED ──customer accepts an offer──▶ ACCEPTED ──▶ DRIVER_ARRIVED ──▶ IN_PROGRESS ──▶ COMPLETED
    │                                       │               │
    ├──▶ EXPIRED (nothing accepted before expiresAt)
    └───────────────────────────────────────┴───────────────┴──▶ CANCELLED
```

| From             | To               | Actor                                 |
| ---------------- | ---------------- | ------------------------------------- |
| —                | `REQUESTED`      | CUSTOMER                              |
| `REQUESTED`      | `ACCEPTED`       | CUSTOMER (accepting a driver's offer) |
| `REQUESTED`      | `EXPIRED`        | SYSTEM                                |
| `REQUESTED`      | `CANCELLED`      | CUSTOMER, ADMIN                       |
| `ACCEPTED`       | `DRIVER_ARRIVED` | DRIVER (assigned)                     |
| `ACCEPTED`       | `CANCELLED`      | CUSTOMER, DRIVER, ADMIN               |
| `DRIVER_ARRIVED` | `IN_PROGRESS`    | DRIVER (assigned)                     |
| `DRIVER_ARRIVED` | `CANCELLED`      | CUSTOMER, DRIVER, ADMIN               |
| `IN_PROGRESS`    | `COMPLETED`      | DRIVER (assigned)                     |

`COMPLETED`, `CANCELLED` and `EXPIRED` are terminal. The table is `TRIP_TRANSITIONS` in
`trip.constant.ts`. `assertTransitionAllowed` (`trip.policy.ts`) applies it, and
`TripService.transition` is the only way a status changes. **Built.**

### RIDE vs PARCEL

Both types share one lifecycle and one table. A parcel also needs `recipientName` and
`recipientPhone`. A DB `CHECK` (`CHK_trips_parcel_recipient`) enforces that, and the DTO will
validate it too. `packageDescription` is optional.

### Money

Fares are `decimal(10, 2)` in EGP (`TRIP_CURRENCY`, `FARE_PRECISION`, `FARE_SCALE`):

- `proposedFare` is set by the customer.
- `agreedFare` is set when an offer is accepted.

The `pg` driver returns decimals as strings, so the columns use `decimalTransformer` to read them
back as numbers. Round to 2 decimals after any arithmetic (fees, discounts), because JS numbers are
floats.

### History

Every status change appends a `trip_status_history` row with these fields:

- `fromStatus` (null for creation) and `toStatus`
- `actor` and `actorId` (null for SYSTEM)
- `reason`
- `createdAt`

It is the only record of when something happened and who did it. `trips` keeps no
`acceptedAt`, `completedAt` or `cancelledBy` copies. "Completed at" is the `createdAt` of the
`COMPLETED` row. Denormalise a timestamp onto `trips` only when a list query needs it.

`TripActorEnum` belongs to this service, not auth-service's role enum. `SYSTEM` (expiry) is not a
user role, and trip-service stays decoupled from how auth models users.

## Authentication

Built; see [`docs/authentication.md`](../../../docs/authentication.md). trip-service registers
`AuthenticationModule` and the closed-by-default `AuthenticationGuard`, and verifies access tokens
locally against auth-service's JWKS, with no call per request.

- Each request has `@CurrentUser()`: `{ id, email, role, tokenVersion }`.
- Routes restrict roles with `@Roles(UserRoleEnum.CUSTOMER)` and so on. Ownership and assigned-driver
  checks stay in `TripService` (404, then 409, then 403).
- Revocation: a logged-out, deactivated or re-roled user's access token keeps working here until it
  expires, at most 5 minutes. Refresh tokens die at once, so the user cannot get a new one.
- How the WebSocket handshake authenticates is still open. The likely shape is the same access token
  checked by `TokenVerifierService` at connect time, re-checked when it expires.

## Bidding

**Built.** Routes are in `trip-offer.controller.ts`; the rules are in `trip-offer.service.ts` and
`TripService.applyTransition`.

**`trip_offers` table:**

- `id`, `tripId` (FK, cascade), `driverId`
- `amount`: `decimal(10, 2)`, same as the fares
- `status`: PENDING / ACCEPTED / REJECTED / WITHDRAWN / EXPIRED
- timestamps
- `UQ_trip_offers_pending_driver`: unique `(tripId, driverId) WHERE status = 'PENDING'`, so a
  driver has one live offer per trip

**Routes:**

| Route                                              | Actor                                                           |
| -------------------------------------------------- | --------------------------------------------------------------- |
| `POST /api/trips`: create a REQUESTED trip         | CUSTOMER                                                        |
| `GET /api/trips/me`                                | CUSTOMER (requested), DRIVER (assigned)                         |
| `GET /api/trips/open`: REQUESTED, not expired      | DRIVER                                                          |
| `GET /api/trips/:id`                               | customer, assigned driver, ADMIN, or any DRIVER while REQUESTED |
| `GET /api/trips/:id/history`                       | customer, assigned driver, ADMIN                                |
| `POST /api/trips/:tripId/offers` `{ amount }`      | DRIVER                                                          |
| `GET /api/trips/:tripId/offers`                    | CUSTOMER (owner), ADMIN                                         |
| `POST /api/trips/:tripId/offers/:offerId/accept`   | CUSTOMER (owner)                                                |
| `POST /api/trips/:tripId/offers/:offerId/withdraw` | DRIVER (owner)                                                  |
| `POST /api/trips/:id/cancel` `{ reason? }`         | CUSTOMER, DRIVER, ADMIN                                         |

**Rules:**

- **Making an offer** locks the trip `FOR SHARE`, so offers on one trip don't block each other but
  wait for an acceptance in progress. It returns `409` when the trip is not REQUESTED, has
  expired, or the driver already has an active trip. An `amount` equal to `proposedFare` means
  "I'll take it as is".
- **Invariant: no PENDING offer outlives its trip's REQUESTED status.**
  `TripService.applyTransition` enforces it in one place. When a trip leaves REQUESTED, its
  pending offers become:
  - `ACCEPTED`, for the offer being accepted (`acceptedOfferId`)
  - `EXPIRED`, if the trip expired
  - `REJECTED`, otherwise

  If the accepted offer was withdrawn a moment earlier, the whole acceptance rolls back with a
  `409`.

- **Lock order is always trip, then offers.** Creating an offer takes the trip lock. Accepting
  takes it through `applyTransition`, then updates offers. So the flows cannot deadlock.
- **Accepting** looks the offer up through the trip's `customerId`, so a stranger gets `404`
  whatever state the offer is in. Two concurrent accepts for different offers: one wins, the
  other gets `409`. Verified live.
- **Privacy:** drivers browsing open trips (`/trips/open`, or `/trips/:id` while REQUESTED) never
  see the parcel recipient's name or phone. Only the customer, the assigned driver and admins do.
- **Offers are not published to Kafka.** Acceptance already emits REQUESTED→ACCEPTED on
  `trip.status-changed`. An offer topic can come with live notifications.

## Concurrency

**Built.**

- **Row-locked transitions.** `TripService.transition` runs one transaction:
  1. `SELECT … FOR UPDATE` the trip (TypeORM `pessimistic_write`).
  2. Validate the move with `assertTransitionAllowed`, which gives:
     - `404` when it is not the actor's trip (ownership is checked first)
     - `409` when that move does not exist from the current status
     - `403` when the move exists but the actor's role may not make it
  3. `UPDATE` the status, plus `driverId` / `agreedFare` when accepting.
  4. `INSERT` the history row with the real `fromStatus`. Later, the outbox row goes here too.
- **What the lock buys.** A second concurrent caller waits on the lock, then validates against the
  status the first one wrote, and gets a precise `409`. Verified with 20 concurrent
  cancel-vs-expire races: each had exactly one winner, one `409`, and two history rows.
- **Why not a guarded `UPDATE … WHERE status IN (…)`.** `RETURNING` only gives the new values, so
  `fromStatus` would be unknown. And `affected = 0` cannot tell "not found", "not yours", "wrong
  status" and "lost the race" apart.
- **One active trip each**, enforced by partial unique indexes:
  - `UQ_trips_active_customer` on `trips("customerId")`, for status REQUESTED, ACCEPTED,
    DRIVER_ARRIVED or IN_PROGRESS.
  - `UQ_trips_active_driver` on `trips("driverId")`, for status ACCEPTED, DRIVER_ARRIVED or
    IN_PROGRESS.
  - The `WHERE` clauses are built from `CUSTOMER_ACTIVE_TRIP_STATUSES` /
    `DRIVER_ACTIVE_TRIP_STATUSES`.
  - A `23505` on either index becomes a `409` with a message naming who is double-booked.
- **pgbouncer.** The lock lives only inside the transaction. There are no advisory locks,
  `LISTEN`, or session state, so this is safe under pgbouncer's `transaction` pool mode.

## Events and outbox

**Built.** The pattern itself (why, guarantees, costs, how to adopt it) is in
[`docs/patterns/transactional-outbox.md`](../../../docs/patterns/transactional-outbox.md).

- **One topic, `trip.status-changed`, keyed by `tripId`.** Kafka orders messages only within a
  partition, so per-status topics could deliver "cancelled" before "accepted". Consumers filter on
  `toStatus`.
- **Contract** in `libs/src/lib/kafka/trip/`:
  - `TripKafkaTopic` and `TripEventMap`.
  - `TripStatusChangedEvent`, which extends `BaseKafkaEvent` with `tripId`, `type`, `customerId`,
    `driverId`, `fromStatus` (null on creation), `toStatus`, `actor`, `actorId`, `reason`,
    `proposedFare` and `agreedFare`.
  - The trip enums live there too, because consumers need them.
- **Written in the same transaction.** `TripService.create` and `transition` call
  `OutboxService.enqueue(manager, …)` with the transaction's manager, after the history row.
- **Relay** (`OutboxRelayService`): one tick per `OUTBOX_POLL_INTERVAL_MS`.
  - It takes `pg_try_advisory_xact_lock`, so one instance publishes at a time.
  - It sends up to `OUTBOX_BATCH_SIZE` pending rows in id order.
  - On success it sets `publishedAt`; on failure it records `attempts` / `lastError` and retries.
  - It purges published rows older than `OUTBOX_RETENTION_MS` (7 days).
- **Next for bidding:** the bidding plan decides whether offer events share this topic or get
  their own, depending on whether consumers need them ordered against status changes.

## Trip execution

**Built.** `POST /api/trips/:id/arrived`, `/start` and `/complete`, DRIVER only. Each is
`TripService.transition` with actor DRIVER, so a driver who isn't assigned gets `404` and an
out-of-order move gets `409`.

## Live location — WebSocket + Redis

`for live location i need to show disance between driver and customer live as possible`

- **Gateway:** a Socket.IO gateway (`@nestjs/websockets` + `@nestjs/platform-socket.io`).
  - Online drivers emit `location:update` `{ latitude, longitude }` every 3–5 s.
  - The server rate-limits each socket.
- **Redis** (new compose service; port band to be decided):
  - `GEOADD drivers:online <longitude> <latitude> <driverId>` holds each driver's latest position.
  - A per-driver heartbeat key with a short TTL. A driver whose key expired is removed from
    `drivers:online`, so stale drivers never show as nearby.
  - `GEOSEARCH drivers:online FROMLONLAT … BYRADIUS …` answers "drivers near this pickup" and
    "open trips near me".
- **Following a trip:** the customer and the assigned driver join room `trip:<id>`. The driver's
  updates fan out to that room while the trip is `ACCEPTED`, `DRIVER_ARRIVED` or `IN_PROGRESS`.
- **More than one instance:** `@socket.io/redis-adapter` carries room broadcasts between
  instances.
- **Path history:** not written to Postgres point by point. Either batch it (for example, one
  row per trip with a polyline on completion) or keep none.
- **Open questions:**
  - How the WebSocket handshake authenticates (see "Authentication": likely the access token, checked at connect).
  - Whether this becomes its own `tracking-service`. It scales on a different axis from trip
    CRUD, with high-frequency writes and long-lived connections.

## Expiry

A scheduler (`@nestjs/schedule`, not installed yet):

- moves `REQUESTED` trips past `expiresAt` to `EXPIRED`, with actor `SYSTEM`
- moves their PENDING offers to `EXPIRED`

Both go through `TripService.transition`, so expiry can run on several instances at once without
double-processing.

## Notifications

notification-service consumes `trip.*`, starting with:

- "a driver accepted your trip"
- "trip completed" (a receipt with `agreedFare`)

That adds one consumer handler and one template per email.

## Later

- Driver profiles, vehicles, and online/offline availability.
- Ratings, payments, and a fare suggestion for the customer's proposal.
- Display names. trip-service knows users only by id, so it needs to get names (and car
  details) from somewhere: carried in events, or fetched from auth-service.
