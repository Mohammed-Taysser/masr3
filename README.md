# Masr3

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>

✨ Your new, shiny [Nx workspace](https://nx.dev) is ready ✨.

## Infrastructure

masr3 is an Nx monorepo of **three NestJS microservices** — `auth-service`, `notification-service`
and `trip-service` — plus a shared `libs` project. **Docker is infrastructure only**: one Postgres per service,
pgbouncer in front of them, Kafka (KRaft) with Kafka UI, pgAdmin, and Mailhog for dev-only email
testing. App services are never containerized; they run on the host via Nx (see "App services run
on the host"). Package manager is **pnpm**.

> This README describes **what exists on `main`**. Planned work lives in each service's
> `docs/design.md` and moves here when it lands.

### Setup

There are no `pnpm` shortcuts — the root `package.json` `scripts` block is **empty**. Use the
commands directly:

```sh
pnpm install
docker compose up -d                                              # infrastructure

cp apps/auth-service/.env.example apps/auth-service/.env          # if missing
cp apps/notification-service/.env.example apps/notification-service/.env
cp apps/trip-service/.env.example apps/trip-service/.env

npx nx run auth-service:generate-signing-key --name=jwt           # RS256 signing key (once)
openssl rand -hex 32                                              # client secret: set it as
# NOTIFICATION_SERVICE_CLIENT_SECRET (auth-service) and SERVICE_CLIENT_SECRET (notification-service)

npx nx run-many -t migrate                                        # schema for every service
npx nx run auth-service:kafka:create-topics                       # Kafka topics (idempotent)
npx nx run trip-service:kafka:create-topics

npx nx run-many -t serve                                          # run all on the host
```

`.env` is gitignored; `.env.example` and `db.env` are committed. Copy the example before first run.

Useful individual targets:

| Command                                                 | What it does                                                                 |
| ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `npx nx serve auth-service`                             | Run one service on the host                                                  |
| `npx nx run-many -t lint,test,typecheck`                | Lint, test and type-check every project (app, spec and script files)         |
| `npx nx run <service>:migrate`                          | Run pending migrations for one service                                       |
| `npx nx run <service>:migrate-generate --name=X`        | Generate a migration by diffing entities against the live DB                 |
| `npx nx run <service>:migrate-revert`                   | Revert the last migration                                                    |
| `npx nx run auth-service:seed`                          | Seed dev users (`dependsOn: ["migrate"]`)                                    |
| `npx nx run auth-service:kafka:create-topics`           | Create the auth topics, idempotently                                         |
| `npx nx run trip-service:kafka:create-topics`           | Create `trip.status-changed`, idempotently                                   |
| `npx nx run auth-service:generate-signing-key --name=X` | Create `apps/auth-service/secrets/X.{private,public}.pem` (never overwrites) |
| `npx nx run notification-service:preview-templates`     | Render every email to `dist/email-previews/` with an index.html              |

### Database scripts (migrate/seed)

Each service that owns a Postgres database defines its own `migrate` / `migrate-generate` /
`migrate-revert` / `migration-show` targets in **its own `project.json`** — nothing
service-specific lives in the root `package.json`.

These run **on the host**, as plain `ts-node`/TypeORM CLI commands — no docker involved. That works
because each service's `.env` points `DATABASE_HOST`/`DATABASE_PORT` at pgbouncer's
_host-published_ port (`localhost:41500`), the same address the service itself uses under
`nx serve`. Both services use that one port; `POSTGRES_DB` in each `db.env` selects the database.

### Running multiple targets at once

```sh
npx nx run-many -t test                                  # `test` on every project
npx nx run-many -t lint,test,typecheck                   # the pre-commit check, every project
npx nx run-many -t test --projects=auth-service,libs     # limit to specific projects
npx nx run-many -t migrate                               # only projects that define migrate
```

### Running tests

Every project, `libs` included, has a `test` target. It is not written in `project.json`:
`@nx/jest/plugin` (in `nx.json`) infers it for any project with a `jest.config.cts`, and
`@nx/eslint` infers `lint` the same way. `npx nx show project <name>` lists every target a project
really has. There are no `package.json` test scripts; everything runs through Nx from the repo
root.

```sh
npx nx test libs                               # one project (also: auth-service, notification-service)
npx nx test libs --watch                       # re-run on file changes
npx nx test libs dayjs.spec                    # only spec files matching the pattern
npx nx test libs --coverage                    # coverage report → coverage/libs/
npx nx test libs --skip-nx-cache               # force a real run instead of a cached result
```

To run one file, pass a filename pattern, not `--testFile`: the target is plain `jest`, which
silently ignores `--testFile` and runs every suite.

Nx caches results: if nothing in a project changed since the last run, it replays the previous
result instead of running the tests again. Use `--skip-nx-cache` when you want a fresh run.

After changing `libs`, test the services that import it too:

```sh
npx nx run-many -t test --projects=libs,auth-service,notification-service
npx nx affected -t test                        # only projects affected by your changes
```

New specs go next to the code they test, in a `spec/` folder, named `*.spec.ts` — for example
`libs/src/lib/date/spec/dayjs.spec.ts`. Jest finds them automatically; there is nothing to
register. A project with no spec files fails `nx test` ("No tests found"), so add a real spec
rather than switching on `passWithNoTests`.

### Naming & port convention

Compose service keys (`auth-db`, `pgbouncer`, …) are plain names — `docker compose logs auth-db`,
`docker compose restart kafka`. Each `container_name` is prefixed `masr3-` (e.g. `masr3-auth-db`),
so `docker ps` output and cross-container hostnames stay unambiguous.

Host-published ports only — container-internal ports keep each image's default:

| Category       | Band  | Assigned                                                  |
| -------------- | ----- | --------------------------------------------------------- |
| Databases      | 41000 | `auth-db`=41000, `notification-db`=41001, `trip-db`=41002 |
| pgbouncer      | 41500 | `pgbouncer`=41500                                         |
| Messaging      | 42000 | `kafka` (host listener)=42000, `kafka-ui`=42001           |
| DB / infra UI  | 43000 | `pgadmin`=43000                                           |
| Dev-only tools | 45000 | `mailhog` SMTP=45000, web UI=45001                        |

Databases are numbered contiguously in the order they were added; a new service takes 41003.

App services bind their own host port under `nx serve`: **auth-service=7000,
notification-service=7001, trip-service=7002**.

### infrastructure/ layout

```text
infrastructure/
  kafka.env
  pgbouncer/    pgbouncer.ini, userlist.txt
  ui/           pgadmin.env, servers.json
```

Each service's own DB credentials do **not** live here — see below.

### Env files — one source of truth per credential

- **`apps/<service>/.env`** — real values, **gitignored**. Copy from the committed `.env.example`.
  Holds what is specific to that service: `PORT`, `SERVICE_NAME` (reported by `GET /api/health`), `DATABASE_HOST`/`DATABASE_PORT`, `KAFKA_BROKER`
  and its own `KAFKA_CLIENT_ID`. notification-service adds `APP_NAME`, `MAIL_*`,
  `PASSWORD_RESET_URL_BASE` and `KAFKA_CONSUMER_GROUP_ID`; trip-service adds `TRIP_REQUEST_TTL_MS`
  and `OUTBOX_POLL_INTERVAL_MS` / `OUTBOX_BATCH_SIZE` / `OUTBOX_RETENTION_MS`. Every variable is checked at boot by
  that service's `config/env/env.validation.ts`; a missing one fails startup rather than surfacing
  later as `undefined`.
- **`apps/<service>/db.env`** — that service's database credentials
  (`POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB`), committed. The same file is loaded by
  **both** the DB container (`env_file`) and the app on the host (`ConfigModule` /
  `data-source.ts`) — one file, no copy-pasted values to keep in sync.
- `docker-compose.yaml` never sets inline `environment:` for database services — everything flows
  through `env_file:`. (`kafka-ui` is the exception: two plain settings.)

> **Committed secrets.** Both `db.env` files are tracked, so their values are in git history. They
> are dev-only placeholders today. If you put a real value in one, it is disclosed the moment it is
> committed — rotate first, then untrack.

### Dates — always dayjs

**Use `dayjs` for every date: creating, formatting, comparing, adding or subtracting time.** Do
not use `new Date()`, `Date.now()`, `Date.parse`, `toUTCString()`/`toLocaleString()` or
`Intl.DateTimeFormat`, and do not add another date library.

Import it from the shared lib, never from `dayjs` directly:

```ts
import { dayjs } from '@masr3/libs';

dayjs().toISOString(); // now, for an event or a timestamp
dayjs().add(ttlMs, 'millisecond').toDate(); // an expiry, when TypeORM needs a Date
dayjs(expiresAt).diff(dayjs(from), 'minute'); // a duration
dayjs.utc(iso).format('dddd, D MMMM YYYY [at] HH:mm [UTC]'); // shown to a user
```

`libs/src/lib/date/dayjs.ts` is the one configured instance: it registers the `utc` and `timezone`
plugins once, so every service gets the same behaviour. A plugin a service needs is added there,
not in the service. The one exception is a `Date` that a library requires as a value (a TypeORM
column, a JWT option): produce it with `.toDate()` at that boundary. Test fixtures may still use
literal ISO strings.

### pgbouncer

A single `masr3-pgbouncer` fronts every Postgres container (`auth_db`, `notification_db`, `trip_db`).
`infrastructure/pgbouncer/pgbouncer.ini` maps each database name to its Postgres host;
`userlist.txt` holds **plaintext** passwords with `auth_type = plain`, so pgbouncer can answer
whichever challenge the backend asks for (`scram-sha-256` or `md5`) with no extra setup. Pool mode
is `transaction`; revisit if an ORM feature needs session state (advisory locks,
`LISTEN`/`NOTIFY`, prepared statements).

### Kafka

`masr3-kafka` runs `apache/kafka:3.9.0` single-node KRaft, no Zookeeper. It is **plaintext with no
authentication** — fine on a local docker bridge, not for anything shared. `masr3-kafka-ui`
(`http://localhost:42001`) talks to the broker at `masr3-kafka:9092`.

The broker exposes two listeners, because a client reconnects to the address the broker
**advertises**, not the one it bootstrapped with:

| Listener   | Broker port                       | Advertised as      | Use it from                                                                     |
| ---------- | --------------------------------- | ------------------ | ------------------------------------------------------------------------------- |
| `INTERNAL` | `9092`                            | `masr3-kafka:9092` | other containers (kafka-ui, the healthcheck), and `docker exec` into the broker |
| `EXTERNAL` | `9094`, host-published as `42000` | `localhost:42000`  | the host — every service's `KAFKA_BROKER=localhost:42000`                       |

So inside the container use `localhost:9092`, on the host use `localhost:42000`:

```sh
docker exec masr3-kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
```

Do not advertise `localhost:9092` for host clients: it sends them to whatever else owns host port
9092 (another project's broker, say) and the failure looks like a missing topic.

**Topics are created explicitly.** `KAFKA_AUTO_CREATE_TOPICS_ENABLE=false` on the broker and
`allowAutoTopicCreation: false` on both clients, so a typo'd topic name fails instead of silently
creating a topic nobody consumes. `npx nx run auth-service:kafka:create-topics` runs the Kafka CLI
inside the broker container (nothing to install on the host) and is safe to re-run. Its list must
stay in sync with `AuthKafkaTopic` in `libs/src/lib/kafka/auth/auth.topics.ts`. `npx nx run trip-service:kafka:create-topics`
(`apps/trip-service/scripts/kafka-create-topics.sh`) works the same way, and its list must stay in sync
with `TripKafkaTopic` in `libs/src/lib/kafka/trip/trip.topics.ts`.

`auth.password-reset-requested` carries the raw reset token (the email needs a working link), so
that topic is created with `retention.ms=3600000` — the token is useless after
`PASSWORD_RESET_TOKEN_TTL_MS`, and nothing should keep it longer than that plus slack.

`auth-service` produces; `notification-service` consumes all six topics as consumer group
`notification-service` (`KAFKA_CONSUMER_GROUP_ID`).

| Topic                           | Published by       | What notification-service does with it |
| ------------------------------- | ------------------ | -------------------------------------- |
| `auth.user-register`            | `register()`       | Welcome email                          |
| `auth.user-logged-in`           | `login()`          | New sign-in alert                      |
| `auth.user-logged-out`          | `logout()`         | Nothing — people sign out on purpose   |
| `auth.user-change-password`     | `changePassword()` | "Your password was changed"            |
| `auth.password-reset-requested` | `forgetPassword()` | The reset email (masked copy stored)   |
| `auth.password-reset-completed` | `resetPassword()`  | "Your password has been reset"         |

**trip-service** produces one topic, `trip.status-changed`, keyed by `tripId`. It publishes
through its outbox (see "trip-service" below), not best-effort, and nothing consumes it yet. Its
payload is `TripStatusChangedEvent` in `libs`.

Every event carries `eventId` (a UUID) and `occurredAt`, and is keyed by `userId`, so one user's
events stay on one partition and are consumed in order. Payloads are typed by `AuthEventMap` in
`libs`: `KafkaProducerService.publish()` will not compile with a payload that does not match its
topic.

**Publishing is best-effort.** `publish()` logs and swallows broker failures, because a Kafka
outage must not turn `register` or `login` into a 500. The cost: a dropped
`auth.password-reset-requested` means the user is told instructions were sent and no email
arrives. Closing that needs a transactional outbox, which does not exist yet.

#### How the consumer handles failure

`KafkaConsumerService` sorts every message into one of three outcomes:

- **Can never succeed** — unknown topic, invalid JSON, no `eventId`/`email`. Logged and skipped, so
  one bad message cannot block the partition behind it.
- **Delivery failed** (SMTP down, unsupported channel) — not an exception. It is stored as a
  `FAILED` row with the error, and the offset moves on.
- **Anything else** (the database is unreachable) — rethrown on purpose. The offset is not
  committed and kafkajs retries, instead of acknowledging an event that was never handled.

**Idempotency.** Kafka delivers at least once. Before sending, the service inserts a `PENDING` row
keyed by the event's `eventId`, which is unique — a redelivered event fails that insert and is
skipped. Verified by rewinding the consumer group to the start of every topic: every event was
redelivered and no second email went out.

The consumer subscribes with `fromBeginning: true`, which only matters while the group has no
committed offset: events published before notification-service first ran are still delivered.
Changing `KAFKA_CONSUMER_GROUP_ID` starts a new group and therefore replays everything still in
retention — harmless thanks to the idempotency check, but worth knowing.

### Mail (Mailhog + nodemailer)

**Mailhog is a dev tool that starts with the rest of the stack** — SMTP on `45000`, web UI on
`http://localhost:45001`. Do not ship this compose file anywhere real without removing it.

`notification-service` sends through `nodemailer` (`src/modules/mail/`). `MAIL_HOST` / `MAIL_PORT` /
`MAIL_SECURE` / `MAIL_FROM` are required; `MAIL_USER` / `MAIL_PASSWORD` are optional (Mailhog
needs neither), and whether to authenticate is decided by `MAIL_USER`, not by `MAIL_SECURE`.

`MAIL_SECURE` goes through `toBoolean` (`src/shared/transformers/to-boolean.transformer.ts`)
because class-transformer's `enableImplicitConversion` coerces with `Boolean()` and would read
`'false'` as `true`.

Delivery sits **off the request path**: `forgotPassword` only publishes an event, so a mail outage
cannot fail the HTTP request.

#### Email templates

**Look.** Every email shares `html/layout.html`: the app name above a single card whose top band is green for account email and amber for security email (`SECURITY_TEMPLATES` in `notification.constant.ts`), which also adds a "Security notice" line. Each email sets a `preheader`, the inbox preview text. The layout includes a dark palette for Apple Mail and Outlook.com, a fixed 600px wrapper for Outlook desktop, and table-based buttons that keep their shape in Outlook. Gmail drops web fonts, so the type is a system stack.

Templates are files, not TypeScript — `src/modules/notification/templates/html/*.html` and
`text/*.txt`, with `{{placeholder}}` substitution by `TemplateService`. Template names are
`NotificationTemplateEnum`; each value is a file name.

- Each email renders twice from one set of variables: the HTML fragment into `html/layout.html`,
  the text fragment into `text/layout.txt`, so the two parts cannot drift.
- Values are HTML-escaped on the way in. Repeated markup (the rows of the sign-in details table)
  lives in `html/partials/*.html` and is rendered with `renderPartial`, then passed to `render` as
  an `htmlFragments` entry — the one way to insert markup unescaped.
- HTML comments are stripped when a template loads. Templates document their placeholders in
  comments; without stripping, those placeholders were filled too and every email carried a hidden
  comment containing, for the reset email, the live link.
- The reset email renders twice: once with the real token for the recipient, once with
  `token=***` for the stored `body`, so the raw token never reaches the database.

**Templates are read at runtime, so they must reach `dist/`.** `webpack.config.js` copies them with
an `assets` glob; without it a built bundle fails on the first send while tests still pass.

To look at every email without sending anything:

```sh
npx nx run notification-service:preview-templates   # → dist/email-previews/index.html
```

It renders through the real `NotificationService` handlers with an in-memory mail transport and
repository, so a preview is exactly what would be sent. `index.html` links each template's HTML and
text part, plus the stored (masked) copy where it differs.

### Authentication

auth-service signs RS256 tokens; every service verifies them **locally** against
`GET http://localhost:7000/api/.well-known/jwks.json`, with one shared guard from `@masr3/libs`.
Full guide — token types, access matrix, how to protect routes and call other services, rotation
and compromise procedures: **[`docs/authentication.md`](docs/authentication.md)**.

| Token   | Lifetime      | Accepted by                                                  |
| ------- | ------------- | ------------------------------------------------------------ |
| Access  | 5 minutes     | every ordinary protected route, in every service             |
| Refresh | 7 days, fixed | only `POST /api/auth/refresh`                                |
| Service | 5 minutes     | only `@RequireServiceScopes(...)` (`/api/internal/*`) routes |

- Login and register return `{ accessToken, refreshToken, tokenType, expiresIn, user }`.
- Logout, a password change or reset, deactivation and a role change bump the user's `tokenVersion`:
  every refresh token dies, auth-service rejects old access tokens at once, other services within
  the 5-minute access-token lifetime.
- Services get service tokens from `POST /api/service-tokens` with their own Basic client secret;
  allowed audiences and scopes live in `SERVICE_CLIENTS` (auth-service). Each `SERVICE_NAME` must
  equal the service's registry id/audience.
- `/api/internal/*` and `/api/service-tokens` must never be routed by a public ingress.

### notification-service

Consumes auth events and records every delivery attempt in its own Postgres (`notification-db`,
table `notifications`). It has **no notification HTTP API yet** — only `GET /api/health`.
It is the first service-token caller: `AuthServiceClient` (`src/clients/`) reads a user's contact
from auth-service's internal route, ready for the coming `trip.*` notifications.

A row is written as `PENDING` before the delivery attempt and updated to `SENT` or `FAILED`, so a
crash mid-send leaves something visible. `SELECT * FROM notifications WHERE status = 'FAILED'` is
the dead-letter view; there is no Kafka `.dlq` topic.

### trip-service

Owns trips — rides and parcels, in the inDrive style (the customer proposes a fare, drivers
counter-offer). Tables `trips`, `trip_status_history`, `trip_offers` and `outbox_events` live in
`trip-db`. Every route except `GET /api/health` needs a user access token from auth-service; the
guard is closed by default. Full API at `http://localhost:7002/api/docs`.

| Route (`/api/trips`)                       | Role                    | Does                                                   |
| ------------------------------------------ | ----------------------- | ------------------------------------------------------ |
| `POST /`                                   | CUSTOMER                | Request a ride or parcel at a proposed fare            |
| `GET /me`                                  | CUSTOMER, DRIVER        | My trips (requested, or assigned), paginated           |
| `GET /open`                                | DRIVER                  | REQUESTED trips open for offers (no recipient contact) |
| `GET /:id`, `GET /:id/history`             | any                     | If visible to the caller, else 404                     |
| `POST /:tripId/offers` `{ amount }`        | DRIVER                  | Make an offer                                          |
| `GET /:tripId/offers`                      | CUSTOMER, ADMIN         | The trip's offers                                      |
| `POST /:tripId/offers/:offerId/accept`     | CUSTOMER                | Accept: driver assigned, others rejected               |
| `POST /:tripId/offers/:offerId/withdraw`   | DRIVER                  | Withdraw my pending offer                              |
| `POST /:id/arrived`, `/start`, `/complete` | DRIVER (assigned)       | Run the trip                                           |
| `POST /:id/cancel` `{ reason? }`           | CUSTOMER, DRIVER, ADMIN | Cancel; pending offers are rejected                    |

Try the whole flow (seeded users, password `ChangeMe123!`; login is rate-limited to 3/s):

```sh
A=http://localhost:7000/api; T=http://localhost:7002/api
tok() { curl -s -X POST $A/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"$1\",\"password\":\"ChangeMe123!\"}" | jq -r .accessToken; }
C=$(tok customer@masr3.local); sleep 1; D=$(tok rider@masr3.local)

TRIP=$(curl -s -X POST $T/trips -H "Authorization: Bearer $C" -H 'Content-Type: application/json' \
  -d '{"type":"RIDE","pickupLatitude":30.0444,"pickupLongitude":31.2357,"pickupAddress":"Tahrir",
       "dropoffLatitude":30.0131,"dropoffLongitude":31.2089,"dropoffAddress":"Giza","proposedFare":85}' | jq .id)
OFFER=$(curl -s -X POST $T/trips/$TRIP/offers -H "Authorization: Bearer $D" \
  -H 'Content-Type: application/json' -d '{"amount":90}' | jq .id)
curl -s -X POST $T/trips/$TRIP/offers/$OFFER/accept -H "Authorization: Bearer $C" | jq .status
for step in arrived start complete; do
  curl -s -X POST $T/trips/$TRIP/$step -H "Authorization: Bearer $D" | jq .status
done
curl -s $T/trips/$TRIP/history -H "Authorization: Bearer $C" | jq '.[].toStatus'
```

- Fares are `decimal(10, 2)` in EGP (`TRIP_CURRENCY`). `decimalTransformer` turns pg's string back into a number.
- A parcel must name a recipient — enforced by the `CHK_trips_parcel_recipient` constraint.
- `TripService.create` and `TripService.transition` are the only ways a trip is written.
  - Each runs in one transaction and appends a `trip_status_history` row (who, when, why).
    `trips` holds no copies of those timestamps.
  - A transition locks the trip row, so concurrent changes are serialised. The loser gets a
    `409`.
- One active trip per customer and per driver, enforced by the partial unique indexes
  `UQ_trips_active_customer` / `UQ_trips_active_driver`.
- `TRIP_REQUEST_TTL_MS` sets `expiresAt` on new trips. Nothing expires them yet.
- **Every status change is published to `trip.status-changed` through a transactional outbox.**
  - The event row is written in the same transaction as the change.
  - `OutboxRelayService` sends pending rows to Kafka in order and retries until Kafka accepts
    them.
  - Nothing is lost while Kafka is down; the rows wait. See
    [`docs/patterns/transactional-outbox.md`](docs/patterns/transactional-outbox.md).
  - Pending or failing events:
    `SELECT * FROM outbox_events WHERE "publishedAt" IS NULL ORDER BY id`.

The planned lifecycle, bidding, concurrency, outbox, live location (WebSocket + Redis) and expiry
are in [`apps/trip-service/docs/design.md`](apps/trip-service/docs/design.md).

### API docs (Swagger)

| Service                | UI                               | OpenAPI JSON        |
| ---------------------- | -------------------------------- | ------------------- |
| `auth-service`         | `http://localhost:7000/api/docs` | `.../api/docs-json` |
| `notification-service` | `http://localhost:7001/api/docs` | `.../api/docs-json` |
| `trip-service`         | `http://localhost:7002/api/docs` | `.../api/docs-json` |

auth-service's Swagger groups the service-only routes (`/service-tokens`, `/internal/...`) under the
`internal` tag; use **Authorize** with `bearer` for user and service tokens, `basic` for client
credentials.

### DB UI

- **pgAdmin** (`http://localhost:43000`) — every Postgres connection is pre-registered via
  `infrastructure/ui/servers.json`; you are asked for the password once per session. pgAdmin
  imports that file only on its first start, so an existing `masr3_pgadmin_data` volume will not
  show a newly added server. Re-import the file, which replaces the registered servers:
  `docker exec masr3-pgadmin /venv/bin/python3 /pgadmin4/setup.py load-servers /pgadmin4/servers.json --user pgadmin4@pgadmin.org --replace`.

### Monitoring & tracing

None. No service exposes `/metrics` — only `GET /api/health`.

### App services run on the host

The app services never run as containers — `docker-compose.yaml` holds
only infrastructure. Run one with `npx nx serve auth-service`, or all of them with
`npx nx run-many -t serve`. That gets Nx's webpack watch for free, with no image rebuilds.

Each service's `.env` points at every dependency's _host-published_ port — pgbouncer at
`localhost:41500`, Kafka at `localhost:42000` — never a docker-internal hostname. The same `.env`
is therefore correct whether you run one service or all of them.

Every `nx serve` also starts the Node inspector, each service on its own port so they can all run
at once: `auth-service`=9229, `notification-service`=9230, `trip-service`=9231 (the serve target's
`port` option). To debug, keep `nx serve` running in a terminal and start one of the **Attach …**
configurations in `.vscode/launch.json` (or **Attach all services**). They reattach after each
webpack rebuild restarts the app.

`apps/auth-service/Dockerfile` still builds a deployable image if you need one; it is not part of
the local stack.

### Healthchecks

Each infrastructure container that can report health does: `pg_isready` per Postgres, a broker
API-versions check on the internal listener for Kafka, and a TCP check for pgbouncer. App health is
`GET /api/health` on each service, deliberately public — a probe that needs a token is a restart
loop, not a security improvement.

[Learn more about this workspace setup and its capabilities](https://nx.dev/nx-api/nest?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) or run `npx nx graph` to visually explore what was created. Now, let's get you up to speed!

## Run tasks

To run the dev server for your app, use:

```sh
npx nx serve auth-service
```

To create a production bundle:

```sh
npx nx build auth-service
```

To see all available targets to run for a project, run:

```sh
npx nx show project auth-service
```

These targets are either [inferred automatically](https://nx.dev/concepts/inferred-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) or defined in the `project.json` or `package.json` files.

[More about running tasks in the docs &raquo;](https://nx.dev/features/run-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Add new projects

While you could add new projects to your workspace manually, you might want to leverage [Nx plugins](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) and their [code generation](https://nx.dev/features/generate-code?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) feature.

Use the plugin's generator to create new projects.

To generate a new application, use:

```sh
npx nx g @nx/nest:app demo
```

To generate a new library, use:

```sh
npx nx g @nx/node:lib mylib
```

You can use `npx nx list` to get a list of installed plugins. Then, run `npx nx list <plugin-name>` to learn about more specific capabilities of a particular plugin. Alternatively, [install Nx Console](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) to browse plugins and generators in your IDE.

[Learn more about Nx plugins &raquo;](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) | [Browse the plugin registry &raquo;](https://nx.dev/plugin-registry?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Set up CI!

### Step 1

To connect to Nx Cloud, run the following command:

```sh
npx nx connect
```

Connecting to Nx Cloud ensures a [fast and scalable CI](https://nx.dev/ci/intro/why-nx-cloud?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) pipeline. It includes features such as:

- [Remote caching](https://nx.dev/ci/features/remote-cache?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Task distribution across multiple machines](https://nx.dev/ci/features/distribute-task-execution?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Automated e2e test splitting](https://nx.dev/ci/features/split-e2e-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Task flakiness detection and rerunning](https://nx.dev/ci/features/flaky-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

### Step 2

Use the following command to configure a CI workflow for your workspace:

```sh
npx nx g ci-workflow
```

[Learn more about Nx on CI](https://nx.dev/ci/intro/ci-with-nx#ready-get-started-with-your-provider?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Install Nx Console

Nx Console is an editor extension that enriches your developer experience. It lets you run tasks, generate code, and improves code autocompletion in your IDE. It is available for VSCode and IntelliJ.

[Install Nx Console &raquo;](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Useful links

Learn more:

- [Learn more about this workspace setup](https://nx.dev/nx-api/nest?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Learn about Nx on CI](https://nx.dev/ci/intro/ci-with-nx?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Releasing Packages with Nx release](https://nx.dev/features/manage-releases?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [What are Nx plugins?](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

And join the Nx community:

- [Discord](https://go.nx.dev/community)
- [Follow us on X](https://twitter.com/nxdevtools) or [LinkedIn](https://www.linkedin.com/company/nrwl)
- [Our Youtube channel](https://www.youtube.com/@nxdevtools)
- [Our blog](https://nx.dev/blog?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
