# Masr3

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>

✨ Your new, shiny [Nx workspace](https://nx.dev) is ready ✨.

## Infrastructure

masr3 is an Nx monorepo of 6 NestJS microservices (auth, customer, delivery, logging, notification, user). **Docker is infra only** — one Postgres per relational service, MongoDB for logging, pgbouncer in front of Postgres, Kafka (KRaft), Kafka UI, DB UI tools, Prometheus + Grafana, Jaeger, and Mailhog for dev-only email testing. App services are never containerized; they run on the host via Nx (see "App services run on the host" below). Package manager is **pnpm**.

### Setup

```sh
pnpm install
pnpm docker:up          # infra only: dbs, pgbouncer, kafka, ui tools, monitoring
pnpm setup:all          # per service: create .env, migrate, seed, create Kafka topics
pnpm dev:all            # serve every service on the host
```

`pnpm setup:all` creates each `apps/<service>/.env` from its committed `.env.example` if it doesn't exist yet, so there is no copy loop to run by hand — although it never overwrites an `.env` you already have (see "Per-service setup" below).

### Scripts (package.json)

Local dev (no Docker, runs straight through Nx):

| Script           | What it does                                             |
| ---------------- | -------------------------------------------------------- |
| `pnpm dev:all`   | `nx run-many --target=serve --all` — serve every service |
| `pnpm build:all` | `nx run-many --target=build --all`                       |
| `pnpm test:all`  | `nx run-many --target=test --all`                        |
| `pnpm lint:all`  | `nx run-many --target=lint --all`                        |

Docker:

| Script                | What it does                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| `pnpm docker:up`      | Build + start the infra stack (dbs, pgbouncer, kafka, ui tools, monitoring) — no app services, see below |
| `pnpm docker:up:dev`  | Same, plus Mailhog (`--profile dev`)                                                                     |
| `pnpm docker:down`    | Stop everything                                                                                          |
| `pnpm docker:restart` | Down, then up --build                                                                                    |
| `pnpm docker:logs`    | Follow logs for all containers                                                                           |
| `pnpm docker:ps`      | List container status/health                                                                             |
| `pnpm docker:build`   | Build images only                                                                                        |
| `pnpm docker:clean`   | **Destructive** — `down -v --remove-orphans`, drops all volumes/data                                     |

### Per-service setup — `apps/<service>/scripts/setup.sh`

Every app service has one setup script, and it is the single definition of what "this service is set up" means:

```sh
bash apps/auth-service/scripts/setup.sh   # one service
pnpm setup:all                            # every service, in order
```

Each script does the same three things in the same order, so they read identically:

1. **Create `.env`** from `.env.example` if it doesn't exist yet. It never overwrites an existing `.env` — that file holds your local values, and silently rewriting it is how you lose them. If the two define different _keys_, it warns with that diff (see below).
2. **Migrate**, then **seed** — but only if the service actually defines those targets, which is asked of Nx rather than assumed. `customer-service` has neither today, so both steps print "defines no … target — skipped"; the day it gains a `migrate` target, its setup script starts migrating with no edit.
3. **Create Kafka topics** where the service owns them (`auth-service`).

Docker is deliberately **not** checked here — start the infra first (`pnpm docker:up`, as the quickstart above does). Nothing replaced that check, so the failure is yours to hit: for a service with migrations, a database that isn't up surfaces as a connection error out of `migrate`; for one that has no `migrate`/`seed` targets yet (`customer-service`, `delivery-service`), there is nothing to fail, and setup will report the service ready with its database down. What is running on your machine is not what preparing a service means.

The mechanics live once in `scripts/lib/setup-common.sh`; each per-service script is a handful of lines that declare _what_ that service needs. `scripts/setup-all.sh` only sequences them, and discovers them from the filesystem — adding `apps/<new-service>/scripts/setup.sh` is all it takes to be picked up by `pnpm setup:all`.

The individual steps remain available on their own (`npx nx run auth-service:migrate`, `:seed`, `:kafka-create-topics`) — the script orders them, it doesn't replace them.

Comparing `.env` against `.env.example` is the one part of this that is **not** a check — it only warns. It prints the diff in both directions: keys the template defines that your `.env` lacks (usually the ones that would stop a service booting), and keys your `.env` still defines that the template dropped (leftovers). Keys only — values are never compared, and neither file is ever edited. Nothing fails, nothing later in setup reads a result from it, and nothing is repeated at the end of the run; it is something you see and judge.

A setup script is deliberately **not** a rubber stamp. It fails — non-zero, with the reason — rather than declaring a service ready when it can see something that would stop that service working. Your infrastructure is no longer its business, so what remains is Nx itself, plus the target's own failure: a `migrate` that errors takes the script down with it, since every step runs under `set -e`. Nx being unreadable is fatal, because "this project has no `migrate` target" and "Nx is broken" must not look the same — a broken Nx would otherwise silently skip migrations and still print _ready_. The one soft spot: with no `jq` on `PATH` the target list can't be read at all, and `setup::load_targets` warns and skips rather than failing.

### Database scripts (migrate/seed)

Each service that owns a Postgres database defines its own `migrate` / `migrate-generate` / `migrate-revert` / `seed` targets in **its own `project.json`** (currently `auth-service` and `notification-service`) — nothing service-specific lives in the root `package.json` for this. A new service just adds the same targets to its own `project.json`; the root scripts below never need editing again.

These all run **on the host**, plain `ts-node`/TypeORM CLI commands — no docker involved. That works because the committed `apps/<service>/.env` points `DATABASE_HOST`/`DATABASE_PORT` at pgbouncer's _host-published_ port (`localhost:41500`), the same port the service itself connects through when you `nx serve` it — there's no separate docker-internal address to reconcile, since the app never runs inside docker either.

| Command                                    | What it does                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `npx nx run auth-service:migrate`          | Run pending migrations for one service                                                      |
| `npx nx run auth-service:migrate-generate` | Generate a migration — diffs entities against a live DB, never hand-written                 |
| `npx nx run auth-service:migrate-revert`   | Revert the last migration                                                                   |
| `npx nx run auth-service:seed`             | Seed that service's dev users (`dependsOn: ["migrate"]`, so migrate always runs first)      |
| `pnpm setup:all`                           | Every service's `apps/<service>/scripts/setup.sh`, in order — see "Per-service setup" above |

### Running multiple targets/scripts at once

Nx's `run-many` runs one target across every project that defines it, in parallel, skipping projects that don't:

```sh
npx nx run-many -t test                                  # run `test` on every project
npx nx run-many -t test,lint,build                       # several targets in one call, still per-project
npx nx run-many -t test --projects=auth-service,libs     # limit to specific projects
npx nx run-many -t migrate,seed                          # only touches projects that define migrate/seed
```

`pnpm test:all` / `lint:all` / `build:all` are just named shortcuts for common `run-many` calls — reach for `npx nx run-many` directly for anything not already covered by one of those.

### Naming & port convention

Compose service keys (`auth-db`, `pgbouncer`, ...) are plain, undecorated names — `docker compose logs auth-db`, `docker compose restart kafka`, etc. The actual `container_name` for each is still prefixed `masr3-` (e.g. `masr3-auth-db`), so `docker ps` output and cross-container hostnames (used in env files, pgbouncer.ini, Grafana's datasource URL, ...) stay unambiguous. Host-published ports only (container-internal ports keep each image's normal default — only the host side is remapped, to avoid colliding with anything else already running on your machine); there's no "app services" band here since none run in docker:

| Category                   | Base  | Assignments                                                                           |
| -------------------------- | ----- | ------------------------------------------------------------------------------------- |
| Databases                  | 41000 | auth=41000, customer=41001, delivery=41002, logging=41004 (Mongo), notification=41006 |
| pgbouncer                  | 41500 | masr3-pgbouncer=41500                                                                 |
| Messaging                  | 42000 | kafka(host listener)=42000, kafka-ui=42001                                            |
| DB/infra UI tools          | 43000 | pgadmin=43000, mongo-express=43001, redisinsight=43002                                |
| Monitoring/tracing         | 44000 | prometheus=44000, grafana=44001, jaeger-ui=44002, jaeger-otlp-http=44003              |
| Dev-only (`--profile dev`) | 45000 | mailhog-smtp=45000, mailhog-web=45001                                                 |

App services bind directly to their own port on the host when run via `nx serve` (no docker port mapping involved): auth=7000, customer=7001, delivery=7002, logging=7003, user=7004, notification=7005. Each service's `.env` (`AUTH_SERVICE_URL`, etc.) points peers at `http://localhost:<port>/api` accordingly.

### infra/ layout

`infra/` only holds config for tools that aren't owned by any single service — grouped by category, matching the `docker-compose.yaml` section comments:

```text
infra/
  pgbouncer/    pgbouncer.ini, userlist.txt
  messaging/    kafka.env
  ui/           pgadmin.env, servers.json, mongo-express.env
  monitoring/   prometheus.yml, grafana.env, jaeger.env, provisioning/datasources/datasource.yml
```

`provisioning/datasources/` is the one forced exception to "flat" — Grafana itself requires that nested `provisioning/<type>/` shape for anything it auto-loads.

Each Postgres/Mongo service's own DB credentials do **not** live in `infra/` — see below.

### Env files — one source of truth per credential

- `apps/<service>/.env` — real values, gitignored. Copy from `apps/<service>/.env.example` (committed template) before first run. Holds only what's specific to that service: `PORT`, `DATABASE_HOST`/`DATABASE_PORT` (or `MONGO_HOST`/`MONGO_PORT` for logging-service), and the `*_SERVICE_URL` peer contract below — plus notification-service's `JWT_SECRET` (shared with auth-service, see "Shared auth" above), `MAIL_*` (required, see "Mail" below) and optional `PASSWORD_RESET_URL_BASE`.
- `apps/<service>/db.env` — that service's database credentials (`POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB`, or `MONGO_INITDB_ROOT_USERNAME`/`MONGO_INITDB_ROOT_PASSWORD`/`MONGO_INITDB_DATABASE` for logging-service). Lives with the owning service, not under `infra/` — in a "each service owns its own database" microservice layout, the credentials are that service's concern, not shared platform config. The exact same file is loaded by **both** the DB container (`docker-compose.yaml`'s `env_file`) and the app itself when it runs on the host (`ConfigModule`/`data-source.ts` load it directly) — one file, one source of truth, no copy-pasted values to keep in sync.
- Peer-service URLs are **deliberately not** pre-declared. Nothing calls a peer over HTTP yet, so a `*_SERVICE_URL` block would be five static values per service that no code reads and nothing validates — and, being static, they'd drift out of sync with the port convention above with no test to catch it. Add the one URL a real call needs, in the service making the call, when it makes it.
- `docker-compose.yaml` itself never sets inline `environment:` for app/db services — everything flows through `env_file:`.
- `mongo-express` is the one unavoidable exception to "one source of truth": it needs its own `ME_CONFIG_MONGODB_ADMIN*` variable names, which can't be an alias of `MONGO_INITDB_ROOT_*` — so `infra/ui/mongo-express.env` repeats the same credential values as `apps/logging-service/db.env` under different names. Keep the two in sync by hand if you change the Mongo password.

### pgbouncer

Single `masr3-pgbouncer` instance fronts all 5 Postgres containers. `infra/pgbouncer/pgbouncer.ini` maps each service's database name to its own Postgres host in the `[databases]` section. `infra/pgbouncer/userlist.txt` holds **plaintext** passwords with `auth_type = plain` — pgbouncer holds the real password, so it can complete whichever challenge the backend asks for (Postgres 16's default `scram-sha-256`, or `md5`) with no extra server-side configuration, no password re-hashing, and no init scripts. Since app services run on the host, they connect via pgbouncer's host-published port — `DATABASE_HOST=localhost`, `DATABASE_PORT=41500` (each service's committed `.env`) — not the docker-internal `masr3-pgbouncer:6432` address. Pool mode is `transaction`; revisit if your ORM needs session-level features (advisory locks, `LISTEN`/`NOTIFY`, prepared statements).

### Kafka

`masr3-kafka` runs `apache/kafka:3.9.0` (the official Apache Kafka image; Bitnami retired its free-tier tags in 2025) single-node KRaft, no Zookeeper. `masr3-kafka-ui` (`:42001`) is pre-wired to the broker at `masr3-kafka:9092`.

The broker exposes two listeners, because the address it hands a client back must be reachable _from that client_:

| Listener   | Broker port                       | Advertised to clients as | Use it from                                                                                                             |
| ---------- | --------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `INTERNAL` | `9092`                            | `masr3-kafka:9092`       | other containers on `masr3-network` (kafka-ui), and `localhost:9092` when you've exec'd into the kafka container itself |
| `EXTERNAL` | `9094`, host-published as `42000` | `localhost:42000`        | the host — every service's `KAFKA_BROKER=localhost:42000`, and any Kafka CLI you run in your own shell                  |

There is deliberately **no single bootstrap address that works everywhere**. The trap is `docker compose exec`, which puts you _inside_ the container where `localhost` means the container, not your machine: `--bootstrap-server localhost:42000` there fails with `Connection to node 1 (localhost/127.0.0.1:42000) could not be established` — the bootstrap itself succeeds, but the broker then advertises the host-published `42000`, which nothing listens on inside the container. When you exec, use the internal listener:

```sh
docker compose exec -T kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic auth.user-register
```

Don't "fix" this by advertising `host.docker.internal:42000` instead — that name only resolves container→host, so host-side clients (i.e. every service) would break in exchange.

Topics are created idempotently (`--create --if-not-exists`) by `npx nx run auth-service:kafka-create-topics`. Its array in `apps/auth-service/scripts/kafka-create-topics.sh` must stay in sync with `AuthKafkaTopic` in `libs/src/lib/messaging/auth.topics.ts`, including a `<topic>.dlq` for every topic this service **consumes** (`auth.user-logged-in.dlq`, `auth.user-register.dlq`, `auth.user-logged-out.dlq`) — producing to a topic needs no `.dlq`; only the session consumer's dead-letter path writes to them (`session-events.consumer.ts`).

`auth-service` and `notification-service` have `kafkajs` wiring. `auth-service` publishes `auth.user-logged-in`, `auth.user-register`, `auth.user-logged-out`, `auth.user-change-password`, and `auth.password-reset-requested`; its `auth-service-sessions` consumer group turns login/register into `sessions` rows and logout into closing them. `notification-service`'s `notification-service-delivery` group consumes `auth.password-reset-requested` and sends the email. The other four services are still infra-only.

### Shared auth — making a service accept auth-service's tokens

Only `auth-service` issues access tokens; every other service only _verifies_ them. That verification is **not** re-implemented per service — it lives once in `libs/src/lib/auth/`, and a service buys into it with two lines:

```ts
// app.module.ts
imports: [SharedAuthModule]

// some controller
@UseGuards(JwtAuthGuard)
```

That is the whole cost. There is no strategy, guard, principal type, or secret plumbing to copy, so the pieces that must agree byte-for-byte with the issuer can't drift between services.

| Piece                                                   | Role                                                                                                                                                                                                                                                        |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jwt-payload.interface.ts` — `JwtPayload`               | The wire contract: what `auth-service` signs, what every verifier reads.                                                                                                                                                                                    |
| `authenticated-user.interface.ts` — `AuthenticatedUser` | The principal a verified token resolves to (`id`, `email`, `role`).                                                                                                                                                                                         |
| `jwt-strategy-options.ts` — `buildJwtStrategyOptions`   | The single definition of _how_ a token is verified: bearer header only, expiry enforced, HS256 pinned rather than trusting the token's own header, and `JWT_SECRET` via `getOrThrow` so a missing secret fails fast instead of 401-ing every request later. |
| `strategies/jwt-verification.strategy.ts`               | The default verifier — signature + expiry, then map onto the principal.                                                                                                                                                                                     |
| `guards/jwt-auth.guard.ts` — `JwtAuthGuard`             | Applied per-controller, not globally, so a service leaves `/api/health` public without needing a `@Public()` escape hatch.                                                                                                                                  |
| `decorators/current-user.decorator.ts` — `CurrentUser`  | `me(@CurrentUser() user: AuthenticatedUser)`.                                                                                                                                                                                                               |
| `auth.module.ts` — `SharedAuthModule`                   | Wires the strategy; drop into `imports`.                                                                                                                                                                                                                    |

**The issuer keeps its own strategy, on purpose.** `auth-service` extends the _same_ verification options but then re-checks `tokenVersion`/`isActive` against its own `users` table on every request, so logout, password change and deactivation revoke tokens immediately. It can do that precisely because that state is its own; a shared verifier reaching into another service's database would couple every service to another service's schema and uptime.

The consequence for the other services, stated plainly: they verify signature and expiry only, so **`auth-service`'s `JWT_EXPIRES_IN` is the real revocation window** outside the issuer. Closing that gap properly means token introspection or a shared revocation list, not a direct DB read.

**One value still has to be shared by hand:** `JWT_SECRET` must be byte-identical in `apps/auth-service/.env` and in every service that imports `SharedAuthModule`; a mismatch `401`s every request. That's the one thing the library can't enforce for you.

### Mail (Mailhog + nodemailer)

**Mailhog is dev-only** — it's behind the `dev` profile, so it only comes up with `pnpm docker:up:dev`, not plain `pnpm docker:up`. SMTP is host-published at `45000`; the web UI (where you read the messages) is at `45001`.

`notification-service` sends mail through `nodemailer` (`apps/notification-service/src/modules/mail/`). `MAIL_HOST`/`MAIL_PORT`/`MAIL_SECURE`/`MAIL_FROM` are **required** and fail fast at boot if any is missing — `MailService` carries no fallbacks, so a lenient check would only surface as `host: undefined` and mail that silently never sends. `MAIL_USER`/`MAIL_PASSWORD` are optional (Mailhog needs neither), and `PASSWORD_RESET_URL_BASE` controls where the link in the email points (default `http://localhost:3000/reset-password`). The committed `.env.example` points at Mailhog — SMTP `localhost:45000`, no auth, no TLS — so copying it is all a fresh checkout needs. `MailService` logs the transport it settled on at startup — `Mail transport ready: localhost:45000 (secure=false, no auth)` — so a misconfigured host is obvious immediately rather than buried in a failed send.

Delivery sits **off the request path**: `auth-service`'s `forgotPassword` only publishes `auth.password-reset-requested`, and notification-service's consumer (group `notification-service-delivery`) turns that into the email. A mail outage therefore can't fail a password-reset request, and the event waits in Kafka until it sends.

#### Email rendering

Templates live in `src/modules/notifications/templates/` as pure functions with no Nest wiring. A template builds a plain data shape (`EmailLayoutOptions`) and hands it to the shared `email-layout.ts`, which renders it **two ways from one source**: a table-based HTML part with inline styles only — the markup Outlook, Gmail and Apple Mail actually agree on, with the `<style>` block as enhancement rather than a dependency — and a plain-text part, so the two can't drift. The layout escapes all content, so a template never has to think about HTML injection.

The layout also always spells the action's URL out beneath the button, because some clients strip buttons entirely. Adding a template means adding one file that returns `EmailContent` and registering its topic in the consumer; changing the design of every email means editing `email-layout.ts` only.

The reset template renders **twice**: once with the real link for the recipient, once with the query string masked for the stored `body` column — so the record can't diverge from what was sent, and the raw token never reaches the database.

To look at a template while designing it:

```sh
npx nx run notification-service:preview-email   # → dist/email-previews/password-reset.html
```

That writes under `dist/`, which is gitignored. If a hand-written table layout stops being enough, MJML or React Email slot in behind `renderEmailHtml` — that single function is the seam, so nothing else has to change.

### API docs (Swagger)

Services that expose a real HTTP API document it at `/api/docs`:

| Service                | UI                               | OpenAPI JSON        |
| ---------------------- | -------------------------------- | ------------------- |
| `auth-service`         | `http://localhost:7000/api/docs` | `.../api/docs-json` |
| `notification-service` | `http://localhost:7005/api/docs` | `.../api/docs-json` |

`customer-service`, `delivery-service` and `logging-service` are still stubs — a `GET /` and a `GET /health` — and have no Swagger setup or `ValidationPipe` at all, so there is nothing to document yet.

The setup is not repeated per service: `setupSwagger()` in `libs/src/lib/swagger/` is the single `DocumentBuilder` call, which is how the bearer scheme and version stay identical everywhere instead of drifting one service at a time. The same module holds the other two pieces every service shares:

- **`ApiErrorDto`** — the body of _every_ non-2xx response, in one type. It is worth knowing that this envelope is not uniform before relying on it: `message` is an **array** when request validation failed and a **string** otherwise, and `error` is **absent** on errors thrown without a message (an expired token) and on the throttler's 429. Writing that down meant reading it off live responses rather than guessing — the schema is a `oneOf` for exactly that reason, and the `error` field is optional.
- **Composed error decorators** (`ApiValidationError`, `ApiUnauthorizedError`, `ApiForbiddenError`, `ApiNotFoundError`, `ApiThrottledError`, `ApiServiceUnavailableError`) — so a route documents the failures it can actually return, with a description saying _why_, instead of a blanket 400/401/500 that tells an integrator nothing.

Two details the docs now spell out because the code makes them true but surprising: `POST /api/auth/forgot-password` answers 204 whether or not the address is registered (it cannot be used to enumerate accounts), and `POST /api/auth/logout` revokes **every** token for the account, including the one that called it — verified end to end, `me` returns 200 before the logout and 401 after.

### notification-service (delivery + history)

The service that owns "actually send it", extracted so `auth-service` doesn't have to. It consumes domain events and records every delivery attempt in its own Postgres (`notification-db`). **Every route below requires a bearer token issued by auth-service.**

| Route                        | What it does                                                                                                                                                                                 |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/notifications`    | Send one now (ad-hoc / admin use). `201` means the _record_ was created — read `status` in the body for the delivery outcome, so a failed send still leaves an audit row instead of a `500`. |
| `GET /api/notifications`     | List what was sent, newest first. Filters: `channel`, `status`, `recipient`, `template`; paginate with `limit` (max 100) / `offset`.                                                         |
| `GET /api/notifications/:id` | One record; `404` if unknown.                                                                                                                                                                |

| `channel`     | Behaviour today                                                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `EMAIL`       | Delivered through nodemailer → Mailhog (or a real provider via the `MAIL_*` vars).                                                                                                         |
| `SMS`, `PUSH` | No transport registered yet — the record is stored as `FAILED` with `error: "No transport registered for channel SMS yet"`, so the gap is visible in the API rather than silently dropped. |

**This service has no Kafka `.dlq`, on purpose.** A failed delivery is already a persisted `FAILED` row, which is strictly more useful than a dead-letter message: `GET /api/notifications?status=FAILED` _is_ the dead-letter view, it's queryable and filterable, and it survives consumer restarts.

**Auth.** `NotificationsController` is guarded by the shared `JwtAuthGuard` from `libs` — this service contains no auth code of its own beyond `imports: [SharedAuthModule]` and `@UseGuards(JwtAuthGuard)`. `GET /api/health` deliberately stays public so healthchecks keep working. See "Shared auth" above for the contract and the `JWT_SECRET` caveat.

The reset-token template also persists a _masked_ body (`token=***`), so `GET /api/notifications` can't be used to harvest live reset tokens even by an authorized caller.

Because this uses the shared verifier, it checks signature and expiry only — a token revoked in auth-service stays valid here until it expires (see "Shared auth" above).

### DB / infra UI tools

- **pgAdmin** (`:43000`) — all 4 Postgres connections are pre-registered via `infra/ui/servers.json`; you'll still be asked for the password once per session.
- **mongo-express** (`:43001`) — pre-configured against `masr3-logging-db` via `infra/ui/mongo-express.env`.
- **RedisInsight** (`:43002`) — no reliable non-interactive provisioning; add the `masr3-redis:6379` connection by hand on first visit.

### Monitoring & tracing

- **Prometheus** (`:44000`) scrapes only itself for now — no service exposes `/metrics` yet, only `/api/health`.
- **Grafana** (`:44001`) auto-provisions the Prometheus datasource via `infra/monitoring/provisioning/datasources/datasource.yml`.
- **Jaeger** (`:44002` UI, `:44003` OTLP HTTP) — `jaegertracing/all-in-one`, in-memory storage. No service emits traces yet (no OpenTelemetry SDK wired); infra is ready for when that's added.

### App services run on the host

**What:** `auth-service`/`customer-service`/`delivery-service`/`logging-service`/`notification-service`/`user-service` are never run as docker containers — `docker-compose.yaml` only ever holds infra (DBs, pgbouncer, kafka, UI tools, monitoring). Run a service with `npx nx serve auth-service`, or all of them with `pnpm dev:all`.

**Why:** running the app on the host gets Nx's webpack watch/HMR for free — edit-and-see-it-immediately, no image rebuild step. A docker container for the app would need a bind mount plus an anonymous volume for `node_modules` to get the same live-reload experience, for no real benefit over just running it on the host directly, since the app already talks to dockerized infra over `localhost` either way.

**How:** each service's committed `.env` points at every dependency's _host-published_ port — pgbouncer at `localhost:41500`, Kafka at `localhost:42000`, peer services at their own `localhost:<port>` — never a docker-internal hostname like `masr3-pgbouncer`. That's what makes this work with zero per-developer configuration: the same `.env` is correct whether you're running one service or all of them, because everything (app included) talks to everything else over `localhost`.

`apps/<service>/Dockerfile` (`build`/`runtime` stages — `nx build --configuration=production` baked into an image) still exists and still works if you ever need a real deployable image (e.g. `docker build --target runtime ...` for an actual deployment target) — it's just not part of the local `docker-compose.yaml` stack.

### Healthchecks

Every infra container has a `HEALTHCHECK`/compose healthcheck: `pg_isready` per Postgres, `mongosh` ping for Mongo, `redis-cli ping` for Redis, a broker API-versions check for Kafka, a TCP check for pgbouncer. Docker isn't waiting on app services (there aren't any); app-level health is `GET /api/health` on whichever service you've started with `nx serve`.

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
