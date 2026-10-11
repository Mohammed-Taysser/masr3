# masr3

masr3 is an inDrive/Uber-style platform that moves people (rides) and things (parcels). It is an
Nx monorepo of NestJS microservices plus a shared `libs` project. Package manager: **pnpm**.
Docker runs only the infrastructure. The apps run on the host through Nx.

| Service                | Port | Database (host port)      | Role                                                                               |
| ---------------------- | ---- | ------------------------- | ---------------------------------------------------------------------------------- |
| `auth-service`         | 7000 | `auth-db` (41000)         | Users, JWT, roles CUSTOMER / DRIVER / ADMIN; produces `auth.*`                     |
| `notification-service` | 7001 | `notification-db` (41001) | Consumes `auth.*`, sends email                                                     |
| `trip-service`         | 7002 | `trip-db` (41002)         | Trips (RIDE / PARCEL), inDrive bidding. Design: `apps/trip-service/docs/design.md` |

All apps reach Postgres through pgbouncer (`localhost:41500`) and Kafka at `localhost:42000`.
`README.md` documents what exists, and is the reference for infrastructure, ports and Kafka.

## Commands

- Nx only. The root `package.json` has no scripts.
- `npx nx serve <svc>` runs one app. `npx nx run-many -t serve` runs all of them.
- `npx nx run-many -t lint,test,typecheck` must pass before work counts as done.
- `npx nx test <project> <pattern>` runs matching specs. Pass a pattern, not `--testFile`, which
  is silently ignored.
- `npx nx run <svc>:migrate` / `migrate-revert` / `migration-show` /
  `migrate-generate --name=<kebab-name>`.
- In this shell `rm` and `cp` are aliased to interactive mode, so use `rm -f` and `cp -f` in
  scripts.
- Never `pkill -f` / `pgrep -f … | kill` with a pattern that also appears in your own command
  line: it kills the shell running it. Kill by PID from `ps -eo pid,args | grep "[p]attern"`.

## Migrations

- **Never write a migration file by hand.** Always create it with the CLI:
  `npx nx run <svc>:migrate-generate --name=<kebab-name>`. Run it against the live database with
  every earlier migration already applied.
- Format the generated file with `npx prettier --write <file>`.
- Check every migration three ways:
  - `migrate`, then `migrate-revert`, then `migrate` all succeed.
  - A second `migrate-generate` reports "No changes".
  - If tables already hold rows, the migration also works on that data.
- If the generated migration would break on existing data, show it and ask how to proceed. Do not
  write a replacement.
- A migration that has not been committed may be reverted, deleted and regenerated. A committed
  one never is: add a new migration instead.
- If a service's entities import `@masr3/libs`, its `migrate*` targets need
  `TS_NODE_BASEURL="$PWD" NODE_OPTIONS="-r tsconfig-paths/register"`, as trip-service has.
  Without it the CLI fails with "Cannot find module '@masr3/libs'".

## Code style

- **Full words in identifiers.** Write `latitude` / `longitude`, never `lat` / `lng`, and no other
  abbreviations. This covers columns, DTO fields, event payloads and variables.
- **Comments are sparse.** Comment only a non-obvious _why_, in a line or two. No docblocks
  restating the code.
- **Prettier** uses `singleQuote`. Run it on every file you touch.
- **Errors:**
  - Throw inline at the point of failure: ``throw new NotFoundException(`Trip ${id} not found`)``.
  - No helpers that build or map exceptions (`tripNotFound()`, `toConflict(error)`).
  - A boolean predicate such as `isUniqueViolation(error, index)` is fine. The `catch` then
    throws the exception itself.
- **Exports:**
  - Classes (services, controllers, modules, entities, DTOs, guards) use `export default`.
  - Enums, constants, functions and interfaces are declared, then exported once at the bottom
    with `export { A, B };` (use `export type { … }` for interfaces and types).
- **Literals:** the moment a literal repeats, it goes into an enum or a constant.
  - Enums live in `<module>.enum.ts`, constants in `<module>.constant.ts`, interfaces in
    `<module>.interface.ts`. Each is one flat file per module, next to the module.
  - Enum names end in `Enum` (`TripStatusEnum`), and their values are UPPERCASE strings.
  - Use a plain `enum`, never `const enum`, because files are transpiled in isolation.
- **Dates:** always `dayjs`, imported from `@masr3/libs`.
  - Never use `new Date()`, `Date.now()`, `Date.parse`, `Intl`, or another date library.
  - Call `.toDate()` only at a library boundary (a TypeORM column, a JWT option).
- **Money** is `decimal` in the currency's major unit (EGP, 2 decimals), never a float column.
- **Shared code:**
  - Scope it to the service (`src/shared/…`) by default.
  - Put it in `libs` only when it is truly cross-service (Kafka contracts, dayjs).
  - Import libs as `@masr3/libs`.
- **No shell wrappers.** Use an Nx `run-commands` target that calls the tool directly, for
  example `ts-node -r tsconfig-paths/register <script>`, not a `.sh` that does the same.

## Service layout

```text
apps/<svc>/
  .env            gitignored real values
  .env.example    committed, kept in sync with .env and env.validation.ts
  db.env          committed POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB (also read by docker)
  project.json    serve, migrate*, migration-show, typecheck (build/lint/test are inferred)
  webpack.config.js
  docs/design.md  planned work (optional)
  src/
    main.ts         /api prefix, ValidationPipe({ whitelist, transform }),
                    ClassSerializerInterceptor({ excludeExtraneousValues: true }),
                    Swagger at /api/docs, port from env
    app.module.ts
    config/config.module.ts           ConfigModule.forRoot({ isGlobal, envFilePath: [.env, db.env], validate })
    config/env/env.validation.ts      class-validator EnvironmentVariables + validate()
    database/database.module.ts       TypeOrmModule.forRootAsync, entities listed explicitly, synchronize: false
    database/data-source.ts           CLI DataSource (dotenv .env + db.env), same entity list
    database/migrations/              <timestamp>-<kebab-name>.ts, CLI-generated only
    health/                           public GET /api/health → { status, service: SERVICE_NAME, timestamp }
    kafka/                            producer and/or consumer service + module (when the service uses Kafka)
    modules/<name>/
      entities/<name>.entity.ts
      dto/*.dto.ts
      <name>.enum.ts  <name>.constant.ts  <name>.interface.ts
      <name>.module.ts  <name>.service.ts  <name>.controller.ts
      spec/                           *.spec.ts (dto specs in spec/dto/)
```

## Environment

- Every variable is **required**. There are no `?? 'default'` fallbacks.
  - `env.validation.ts` checks every variable at boot, so a missing one fails startup.
  - The exception is a genuinely optional one, marked `@IsOptional()` (e.g. `MAIL_USER`).
- Every service has `NODE_ENV`, `PORT`, `SERVICE_NAME` (its own name, e.g. `trip-service`; read
  from env, not a TS constant), `DATABASE_HOST`, `DATABASE_PORT`, plus `db.env`.
- Booleans go through the service's `toBoolean` transformer. Implicit conversion reads `'false'`
  as `true`.
- When you add or remove a variable, update all four in the same change: `env.validation.ts`,
  `.env.example`, `.env`, and the env spec (its valid env and its required list).
- Add a variable only when code uses it. For example, Kafka keys arrive with the first Kafka
  code.

## Entities (TypeORM + Postgres)

- **Table names** are plural snake_case (`@Entity('trips')`, `trip_status_history`).
- **Columns:** `@PrimaryGeneratedColumn() id: number` (serial, not UUID), plus
  `@CreateDateColumn() createdAt` and `@UpdateDateColumn() updatedAt`.
- **Enums** are real Postgres enums: `@Column({ type: 'enum', enum: XEnum })`.
  - Keep TypeORM's default type names.
  - **Do not share an `enumName` across tables**: the CLI then emits a duplicate `CREATE TYPE`.
- **Nullable columns** spell out the type: `@Column({ type: 'varchar', nullable: true }) x: string | null`.
- **Numbers:**
  - Counts and ids use `int`.
  - Money uses `decimal`, with precision and scale from constants (e.g. `FARE_PRECISION` /
    `FARE_SCALE`) and `transformer: decimalTransformer` (`src/shared/transformers/`). The `pg`
    driver returns decimals as strings; the transformer reads them back as numbers. Round to the
    scale after any arithmetic, because JS numbers are floats.
  - Coordinates use `double precision`, which takes no precision or scale. Round only for
    display.
  - Validate ranges in the DTO (`@IsLatitude()`, `@IsLongitude()`, `@Min()`), not with a column
    format.
- **Indexes** are declared at class level (`@Index(['status'])`).
- **Constraints** use `@Check('CHK_<table>_<rule>', '<sql>')`, so the CLI generates them. Use a
  check for an invariant that must hold no matter which code path writes the row. Example:
  `CHK_trips_parcel_recipient` — a PARCEL trip must have a recipient.
- **Event idempotency:** store the event's `eventId` as a unique column, insert first, and treat
  Postgres error `23505` as "already handled".
- **State changes** (e.g. trip status) happen in one transaction, in this order:
  1. Lock the row: `findOne` with `lock: { mode: 'pessimistic_write' }`.
  2. Validate it in a pure policy function, with its own spec.
  3. Update the row.
  4. Insert the history row.

  Never write status from anywhere else (see `TripService.transition`).

- **pgbouncer** runs in `transaction` mode. Avoid session state: session advisory locks
  (`pg_advisory_lock`), `LISTEN` / `NOTIFY`, and prepared statements that span transactions.
  Transaction-scoped advisory locks (`pg_try_advisory_xact_lock`) are fine, because they are
  released at commit.

## API (controllers + DTOs)

- **Request DTOs** use `class-validator` with `@ApiProperty` / `@ApiPropertyOptional` (an example
  and a description).
- **Response DTOs** mark every exposed field `@Expose()`. Routes declare
  `@SerializeOptions({ type: XResponseDto })`. Because of the global
  `excludeExtraneousValues: true`, a bare entity serialises to `{}`.
- **Swagger:** document every route with `@ApiTags`, `@ApiOperation({ summary, description })`
  and its responses.
- **Auth:** every service registers `AuthenticationModule.register()` and
  `{ provide: APP_GUARD, useExisting: AuthenticationGuard }` from `@masr3/libs` (after its
  throttler). The guard is closed by default. Guide: `docs/authentication.md`.
  - `@Roles(...)` for user routes, `@CurrentUser()` for the principal. Roles are enforced inside
    the guard; there is no separate `RolesGuard`.
  - Service-only routes live under `/internal/...` with class-level `@RequireServiceScopes(...)`.
    Never combine it, or `@Public()`, with `@Roles()`.
  - `@Public()` only skips the guard: `/auth/refresh` and `/service-tokens` authenticate in their
    handler.
  - Call another service through a typed client using `ServiceTokenProvider`, never raw axios in
    business code. New callers go in `SERVICE_CLIENTS` with their own secret env variable.
  - `/api/health` is always public.
- **Logging:** never log tokens, secrets, cookies or `Authorization` headers. Any future HTTP or
  exception logging must redact them, including login, refresh and service-token bodies.

## Kafka

- **Plaintext, no SASL.** Topics are created explicitly: `allowAutoTopicCreation: false` on
  clients, and auto-create is off on the broker.
- **Contracts** live in `libs/src/lib/kafka/<domain>/`:
  - `<domain>.topics.ts`: a plain enum, e.g. `AuthKafkaTopic`, with values
    `<domain>.<kebab-event>`.
  - `<domain>.events.ts`: payload interfaces plus `<Domain>EventMap`, exported with
    `export type`.
  - Export both from `libs/src/index.ts`.
- **Every event** carries `eventId` (`randomUUID()`) and `occurredAt` (`dayjs().toISOString()`).
  It is keyed by the aggregate id (`userId`, `tripId`) to keep ordering.
- **Typing:** `publish<Topic>(topic, event: EventMap[Topic])`, so a mismatched payload does not
  compile. Consumers map every topic to a handler.
- **Consumer failures:**
  - A message that can never succeed (unknown topic, bad JSON, missing fields) is logged and
    skipped.
  - A delivery failure is recorded as a `FAILED` row.
  - Anything else is rethrown, so the offset is not committed.
- **Topic creation:** a service's `kafka:create-topics` target list must match its topic enum.
- **Choosing how to publish:**
  - **Events that must not be lost or invented** (state changes other services rely on) go
    through a transactional outbox. Follow
    [`docs/patterns/transactional-outbox.md`](docs/patterns/transactional-outbox.md); trip-service
    is the reference.
  - **Best-effort direct publishing** is only for events whose loss is harmless, like
    auth-service's sign-in alerts.
- **One topic per aggregate** (e.g. `trip.status-changed`) when consumers need its events in
  order. Kafka orders messages only within a partition, never across topics.

## Tests

- Specs sit next to the code in a `spec/` folder, named `*.spec.ts`. Jest finds them; there is
  nothing to register.
- Every project needs at least one real spec, because `nx test` fails with "No tests found". At
  minimum that is the env-validation spec.
- Mock repositories as `jest.Mocked<Repository<X>>`. Build fixtures as typed objects.
- E2E projects (`apps/<svc>-e2e`) hit the running app. They are excluded from the jest plugin in
  `nx.json`.

## Scaffolding a new service

1. **Infrastructure.** Follow the existing database blocks:
   - In `docker-compose.yaml`, add `<name>-db` (`postgres:16-alpine`, `masr3-<name>-db`, the next
     host port in 41000–41099, `env_file: ./apps/<name>-service/db.env`, `pg_isready`
     healthcheck), its volume, and an entry in `pgbouncer.depends_on` and `pgadmin.depends_on`.
   - `infrastructure/pgbouncer/pgbouncer.ini` (`<name>_db = host=masr3-<name>-db …`) and
     `userlist.txt`.
   - `infrastructure/ui/servers.json`.
   - Then run `docker compose up -d <name>-db` and `docker compose restart pgbouncer`.
2. **App.** Run `npx nx g @nx/nest:app apps/<name>-service --linter=eslint --unitTestRunner=jest --e2eTestRunner=jest --no-interactive`.
   - The generator updates `nx.json` (the jest exclude) and `.vscode/launch.json`.
   - Delete `src/app/`.
   - Reshape to the layout above, copying from `apps/trip-service`. It is the leanest service
     with every pattern.
3. **`project.json`.** Add `migrate`, `migrate-generate`, `migrate-revert`, `migration-show` and
   `typecheck`, copied with paths changed. Give the e2e project a `typecheck` target too.
4. **Env.** Add env files and validation (with spec), `db.env`, and the next app port (7000+).
5. **Schema.** Write the entities, then generate the first migration with the CLI.
6. **E2E.** Point the e2e spec at `GET /api/health` and the service's port.
7. **README.** Update the service count, port tables, setup `cp` line, Swagger table, and add a
   short section on what exists.
8. **Verify.**
   - `lint`, `test` and `typecheck` for every project.
   - `migrate`, `migrate-revert`, `migrate`.
   - `nx serve` and curl `/api/health`.
   - A missing env key fails boot.
   - `npx nx e2e <name>-service-e2e`.

## Docs and git

- `README.md` describes only **what exists on `main`**. Planned work goes in
  `apps/<svc>/docs/design.md` and moves to the README when built.
- Cross-service patterns are written up in `docs/patterns/` (e.g. `transactional-outbox.md`) and
  linked from where they are used.
- Commit messages use the `feat:` / `refactor:` / `chore:` prefixes. Commit only when asked, and
  keep unrelated changes (e.g. an auth-service rename) in their own commit.
- Park large in-progress work as a commit on a `wip/*` branch, not `git stash`.
  `wip/full-implementation` is old test code, not a real implementation: never copy from it.
