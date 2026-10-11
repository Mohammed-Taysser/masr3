# Transactional outbox

How a masr3 service publishes Kafka events that must never be lost or invented. trip-service is
the first user (`apps/trip-service/src/modules/outbox/`). Any service with events that matter can
follow the same steps.

## The problem: a dual write

A state change that also publishes an event writes to two systems, Postgres and Kafka. They share
no transaction, so the work can fail half-way in either order:

| Order                   | Failure                                       | Result                                                            |
| ----------------------- | --------------------------------------------- | ----------------------------------------------------------------- |
| Commit to DB, then send | Kafka is down, or the process dies in between | **Lost event.** The trip changed and nobody was told.             |
| Send, then commit to DB | The commit fails or rolls back                | **Phantom event.** Consumers act on a change that never happened. |

Retrying the send in a `catch` doesn't fix the first case: the process can die before it retries.
auth-service publishes best-effort and accepts the first case (see "When not to use it").

## The fix

The service never talks to Kafka inside the business transaction. The event is written as a row
in the **same** transaction as the state change. A separate relay copies rows to Kafka afterwards.

```text
 TripService.transition ── one Postgres transaction ──────────────┐
   SELECT … FOR UPDATE trips  (lock the row)                      │
   UPDATE trips               (the state change)                  │ all commit
   INSERT trip_status_history                                     │ or none
   INSERT outbox_events       (the event, as a row)               │
 ─────────────────────────────────────────────────────────────────┘
            ▼  later, separately
 OutboxRelayService (one tick per OUTBOX_POLL_INTERVAL_MS)
   lock → read pending rows by id → send to Kafka → mark publishedAt
   Kafka fails → rows stay pending, attempts/lastError recorded, retried next tick
```

The event row exists **if and only if** the state change committed. That one property removes
both failure cases.

## The relay, step by step

Each tick is one Postgres transaction:

1. **`SELECT pg_try_advisory_xact_lock(OUTBOX_RELAY_LOCK_ID)`.** If it returns false, another
   instance is relaying right now, so this tick does nothing. Only one relay ever publishes at a
   time, which is what keeps events in order (step 3).
2. **Read up to `OUTBOX_BATCH_SIZE` rows** where `publishedAt IS NULL`, `ORDER BY id`.
3. **Send them in one `sendBatch`**, in id order, with the message key set to the aggregate id
   (`tripId`). Kafka keeps order per partition, and a key always maps to the same partition, so
   one trip's events reach consumers in the order they happened.
4. Then one of:
   - **Success:** set `publishedAt`.
   - **Failure:** increment `attempts` and set `lastError`. The rows stay pending, and the whole
     batch is retried next tick. Newer rows wait behind it (head-of-line blocking) rather than
     overtake it, because skipping would break order.
5. **Purge** rows published more than `OUTBOX_RETENTION_MS` ago.

Ticks never overlap: the next one is scheduled only after the previous one finishes. The producer
also helps keep order:

- It is idempotent, with one request in flight, so a kafkajs-level retry can't reorder or
  duplicate messages within a partition.
- It connects lazily, so the service boots and keeps accepting writes while Kafka is down.

## Guarantees

- **No lost events.** A committed change always has its row, and the row stays pending until
  Kafka accepts it.
- **No phantom events.** A rolled-back change takes its row with it.
- **At-least-once delivery.** If the relay dies after Kafka accepted a batch but before the
  `publishedAt` update committed, that batch is sent again. **Consumers must be idempotent:**
  deduplicate on `eventId`, as notification-service does with its unique `eventId` column.
- **Per-key order.** All events for one aggregate arrive in commit order.

Verified on trip-service:

- Kafka was stopped while trips kept changing. The calls succeeded and the rows waited with
  `attempts` / `lastError`. After a restart they drained in about 2.5 s, in order.
- Two relays ran against one database: 60 events, each published exactly once, 20/20 trips in
  order.

## Costs

- An extra table and a background loop per service.
- Latency of up to one poll interval (about 1 s by default) between commit and Kafka.
- A batch that can never be sent (for example a missing topic) blocks everything behind it. That
  is deliberate, and it is visible: `SELECT * FROM outbox_events WHERE "publishedAt" IS NULL ORDER BY id`.
- One Postgres connection is held for the duration of a send. The producer's short retry
  (`retries: 2`) keeps that brief when Kafka is down.

## pgbouncer notes

All services reach Postgres through pgbouncer in `transaction` pool mode. Each server connection
is shared between clients at transaction boundaries.

- **`LISTEN/NOTIFY` is out.** A listener needs a session that stays connected, so the relay polls
  instead.
- **Session advisory locks (`pg_advisory_lock`) are out.** The lock would stay on a pooled
  connection that another client then gets.
- **Transaction advisory locks (`pg_try_advisory_xact_lock`) are fine.** Postgres releases them at
  `COMMIT` / `ROLLBACK`, inside the same transaction pgbouncer pins.

## Adopting it in another service

1. **Contract in `libs/src/lib/kafka/<domain>/`:** a topic enum, payloads that extend
   `BaseKafkaEvent` (`eventId`, `occurredAt`), and an `<Domain>EventMap`.
2. **Table and migration:** an `outbox_events` entity (copy
   `apps/trip-service/src/modules/outbox/entities/outbox-event.entity.ts`), then
   `migrate-generate` with the CLI. Add the entity to `database.module.ts` and `data-source.ts`.
3. **Enqueue inside the business transaction:** call `outboxService.enqueue(manager, topic, event, key)`
   with the **transaction's** `manager`, never a repository. Otherwise the row escapes the
   transaction.
4. **Relay and producer:** copy `outbox-relay.service.ts` and `kafka/kafka-producer.service.ts`.
   Give the service its own `OUTBOX_RELAY_LOCK_ID`. Advisory locks are per database, so this only
   matters if two services ever share one, but distinct ids cost nothing.
5. **Env** (required): `KAFKA_BROKER`, `KAFKA_CLIENT_ID`, `OUTBOX_POLL_INTERVAL_MS`,
   `OUTBOX_BATCH_SIZE`, `OUTBOX_RETENTION_MS`.
6. **Topic:** add a `kafka:create-topics` target. Topics are never auto-created.
7. **Consumers:** deduplicate on `eventId`.

## When not to use it

When a dropped event is acceptable and an extra table isn't worth it. auth-service's sign-in alert
is an example: if Kafka is down and one "new sign-in" email never goes out, nothing is corrupted.
auth-service therefore publishes directly and logs failures. Use the outbox when a lost or phantom
event would leave another service, or a user, with the wrong picture of the system: a trip
accepted, a payment captured.
