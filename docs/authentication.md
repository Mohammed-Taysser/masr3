# Authentication

How masr3 authenticates users and services, how to use it in a service, and how to operate it.

`auth-service` is the only service that issues tokens. It signs every token with an **RS256** private
key that never leaves it. Every service, auth-service included, verifies tokens **locally** against
the public keys in auth-service's JWKS. No service calls auth-service to check a user's token.

```text
             login / register / refresh                    GET /api/.well-known/jwks.json
  client  ───────────────────────────────►  auth-service  ◄──────────────────────────────┐
     │      access token + refresh token    (private key)                                │
     │                                           ▲                                       │
     │  Authorization: Bearer <access token>     │ POST /api/service-tokens       trip-service,
     └──────────────────────────────────────►  any service  (Basic client creds)  any verifier
                                             verifies locally ─────────────────────────┘
```

All code is shared from `@masr3/libs/auth` (`libs/src/lib/auth/`). Services only wire it up and configure
it.

## Contents

- [Tokens](#tokens)
- [Who may call what](#who-may-call-what)
- [Revocation](#revocation)
- [Endpoints](#endpoints)
- [Protecting routes in a service](#protecting-routes-in-a-service)
- [Calling another service](#calling-another-service)
- [Adding a scope, a client or an internal endpoint](#adding-a-scope-a-client-or-an-internal-endpoint)
- [Configuration](#configuration)
- [Setup](#setup)
- [Key rotation and compromise](#key-rotation-and-compromise)
- [Client secret rotation and disabling a client](#client-secret-rotation-and-disabling-a-client)
- [Failure behaviour](#failure-behaviour)
- [Code map](#code-map)
- [Tests](#tests)
- [Limitations and production notes](#limitations-and-production-notes)

## Tokens

There are three token types. They are told apart by the `tokenUse` claim **and** by `aud`, a single
exact string that is different for each type. A token is accepted only where its type is expected;
there is never a fallback from one type to another.

| Token   | `tokenUse` | `aud`                                             | Lifetime                       | Accepted by                                      |
| ------- | ---------- | ------------------------------------------------- | ------------------------------ | ------------------------------------------------ |
| Access  | `USER`     | `masr3-api` (`USER_TOKEN_AUDIENCE`)               | 300 s                          | every ordinary protected route, in every service |
| Refresh | `REFRESH`  | `auth-service-refresh` (`REFRESH_TOKEN_AUDIENCE`) | 7 days, fixed (never extended) | only `POST /api/auth/refresh`                    |
| Service | `SERVICE`  | the receiving service's `SERVICE_NAME`            | 300 s                          | only routes marked `@RequireServiceScopes(...)`  |

All three share `iss: "auth-service"`, `iat`, `exp`, an RS256 signature and a `kid` header naming the
signing key.

Access token claims:

```json
{
  "sub": "2",
  "tokenUse": "USER",
  "role": "CUSTOMER",
  "tokenVersion": 0,
  "email": "customer@masr3.local",
  "iss": "auth-service",
  "aud": "masr3-api",
  "iat": 1791702866,
  "exp": 1791703166
}
```

Refresh token claims hold no profile data: `sub`, `tokenUse: "REFRESH"`, `tokenVersion`, plus the
registered claims.

Service token claims:

```json
{
  "sub": "notification-service",
  "tokenUse": "SERVICE",
  "scopes": ["USERS_CONTACT_READ"],
  "iss": "auth-service",
  "aud": "auth-service",
  "iat": 1791702866,
  "exp": 1791703166
}
```

`sub` is always a string. For users it is the numeric id as a string, validated as a positive safe
integer before it is turned back into a number.

### What verification checks

`TokenVerifierService.verify(token, tokenUse, audience)` rejects with 401 unless all of these hold:

1. The header has `alg: "RS256"` and a `kid`. This is checked before any key lookup, so `alg: none`
   and HS256 tokens are refused outright.
2. The `kid` resolves to a published public key.
3. The signature is valid; `iss`, `aud` and `exp` pass, with 5 s clock tolerance.
4. At runtime, beyond what the JWT library checks:
   - `aud` is one string equal to the expected audience. An array that merely contains it is
     rejected.
   - `iat` and `exp` are integers, and `exp > iat`.
5. The profile's claims have the right shape:

| Profile | Required claims                                                                                                   |
| ------- | ----------------------------------------------------------------------------------------------------------------- |
| USER    | `tokenUse === "USER"`, numeric-string `sub`, `role` in `UserRoleEnum`, integer `tokenVersion ≥ 0`, string `email` |
| REFRESH | `tokenUse === "REFRESH"`, numeric-string `sub`, integer `tokenVersion ≥ 0`                                        |
| SERVICE | `tokenUse === "SERVICE"`, non-empty string `sub`, non-empty `scopes` of known `ServiceScopeEnum` values           |

## Who may call what

The global `AuthenticationGuard` is **closed by default** and decides from route metadata:

| Route                                              | Access token                                     | Refresh token | Service token                                                  |
| -------------------------------------------------- | ------------------------------------------------ | ------------- | -------------------------------------------------------------- |
| No decorator (ordinary protected route)            | allowed                                          | 401           | 401                                                            |
| `@Roles(...)`                                      | wrong role → 403                                 | 401           | 401                                                            |
| `@RequireServiceScopes(...)` (wins over `@Public`) | 401, even ADMIN                                  | 401           | right `aud` and **every** scope → allowed; missing scope → 403 |
| `@Public()`                                        | not checked                                      | not checked   | not checked                                                    |
| `@Public()` + `@Roles()`                           | 500, logged as a misconfiguration (fails closed) |               |                                                                |
| `@RequireServiceScopes()` + `@Roles()`             | 500, logged as a misconfiguration (fails closed) |               |                                                                |

`@Public()` only means the guard skips the route. Two public routes authenticate inside their
handler:

| Route                      | Guard   | Handler                                                                                                                  |
| -------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------ |
| `POST /api/auth/refresh`   | skipped | Verifies the refresh token in the body (`@IsJWT` only checks its format), then the user's `isActive` and `tokenVersion`. |
| `POST /api/service-tokens` | skipped | Verifies the Basic client credentials, the audience and every scope.                                                     |

After authentication the guard attaches a typed principal to the request:

- `request.user`, read with `@CurrentUser()`: `{ id, email, role, tokenVersion }`
- `request.service`, read with `@CurrentService()`: `{ name, scopes }`

## Revocation

Every user row has a `tokenVersion`. Each of these bumps it atomically, inside the same `UPDATE`:

- logout
- a password change or reset
- deactivation (`PATCH /api/users/:id/status` with `isActive: false`)
- a role change (`PATCH /api/users/:id` with a different `role`)

What a bump does:

- **Refresh tokens:** all of the user's refresh tokens, on every device, stop working at the next
  refresh. `/auth/refresh` compares the token's `tokenVersion` with the database. Reactivating the
  user does not bring them back.
- **Access tokens on auth-service:** rejected at once. auth-service's `ActiveUserValidator` checks
  `isActive` and `tokenVersion` on every request.
- **Access tokens on other services:** still accepted **until they expire, at most 300 s (+5 s clock
  tolerance)**. Downstream services verify locally and never see the database. This is the revocation
  window.

Email and name changes do not bump `tokenVersion`. The email claim is informational, and the next
refresh rebuilds the claims from current data.

These are deliberate trade-offs of stateless refresh tokens:

- Logging out on one device logs out every device.
- A stolen refresh token works until it expires, unless the user's `tokenVersion` changes.
- There is no per-device logout and no list of sessions.
- The refresh token travels in a JSON body. The first browser client must revisit this (an HttpOnly,
  Secure, SameSite cookie plus CSRF protection) before calling `/auth/refresh` from a browser. Native
  clients keep it in platform secure storage.

## Endpoints

All on auth-service, under `http://localhost:7000/api`.

| Method and path                           | Auth                                | Purpose                                                                            |
| ----------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------- |
| `POST /auth/register`, `POST /auth/login` | public                              | Returns `{ accessToken, refreshToken, tokenType: "Bearer", expiresIn: 300, user }` |
| `POST /auth/refresh`                      | refresh token in body               | Returns `{ accessToken, tokenType, expiresIn }`; no new refresh token              |
| `POST /auth/logout`                       | access token                        | Bumps `tokenVersion`                                                               |
| `GET /.well-known/jwks.json`              | public                              | The public signing keys; `Cache-Control: public, max-age=300`                      |
| `POST /service-tokens`                    | Basic client credentials            | Issues a service token                                                             |
| `GET /internal/users/:id/contact`         | service token, `USERS_CONTACT_READ` | `{ userId, email, firstName, lastName }` or 404                                    |

Swagger lists the service-only routes under the `internal` tag. Using these from Swagger UI's
**Authorize** dialog, and from Postman, is covered in [Swagger UI and Postman](swagger-and-postman.md).

### Examples

```sh
B=http://localhost:7000/api

# Sign in
curl -s -X POST $B/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"customer@masr3.local","password":"ChangeMe123!"}'

# Call a protected route
curl -s $B/auth/me -H "Authorization: Bearer $ACCESS_TOKEN"

# Get a new access token
curl -s -X POST $B/auth/refresh -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}"

# As notification-service: get a service token, then call an internal route
curl -s -X POST $B/service-tokens -u "notification-service:$CLIENT_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"audience":"auth-service","scopes":["USERS_CONTACT_READ"]}'
curl -s $B/internal/users/2/contact -H "Authorization: Bearer $SERVICE_TOKEN"
```

## Protecting routes in a service

trip-service is the reference wiring.

1. Add `AUTH_SERVICE_URL` to the service's env, in all four places: `env.validation.ts`,
   `.env.example`, `.env` and the env spec.

   ```ts
   @IsUrl({ require_tld: false, require_protocol: true })
   @Matches(AUTH_SERVICE_URL_PATTERN)
   AUTH_SERVICE_URL: string;
   ```

2. Register the module and the guard in `app.module.ts`. The guard is not registered by the module
   itself, so each app lists it explicitly, after its throttler if it has one.

   ```ts
   import { AuthenticationGuard, AuthenticationModule } from '@masr3/libs/auth';

   @Module({
     imports: [AppConfigModule, AuthenticationModule.register() /* , ... */],
     providers: [{ provide: APP_GUARD, useExisting: AuthenticationGuard }],
   })
   export default class AppModule {}
   ```

3. Mark the health route `@Public()`. Every other route now needs an access token.

4. Use the decorators:

   ```ts
   import { CurrentUser, Public, RequireServiceScopes, Roles, ServiceScopeEnum, UserRoleEnum } from '@masr3/libs/auth';
   import type { AuthenticatedUser } from '@masr3/libs/auth';

   @Controller('trips')
   class TripController {
     @Post()
     @Roles(UserRoleEnum.CUSTOMER)
     create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTripDto) {
       return this.tripService.create(user.id, dto);
     }
   }

   // Service-only: user tokens get 401, whatever the role. Keep these under /internal.
   @RequireServiceScopes(ServiceScopeEnum.SOME_SCOPE)
   @Controller('internal/trips')
   class InternalTripController {}
   ```

`AuthenticationModule.register()` takes optional settings:

| Option          | Default           | Used by auth-service as                                                  |
| --------------- | ----------------- | ------------------------------------------------------------------------ |
| `keyResolver`   | `JwksKeyResolver` | `LocalKeyResolver`: reads its own keys, with no HTTP call to itself      |
| `userValidator` | none              | `ActiveUserValidator`: a database check of `isActive` and `tokenVersion` |
| `imports`       | none              | the modules those two classes depend on                                  |

The module is global, so `TokenVerifierService` can be injected anywhere. Leave `userValidator`
unset in other services: verification stays local, with no database or auth-service call per
request.

## Calling another service

1. **Register the caller.** See [adding a client](#adding-a-scope-a-client-or-an-internal-endpoint).
2. **Give the caller its env:**
   - `AUTH_SERVICE_URL`;
   - `SERVICE_CLIENT_SECRET`, the same value as the client's secret variable in auth-service;
   - `SERVICE_NAME`, which must equal the client's registry id.
3. **Import `ServiceTokenModule`** and write a typed client. Don't call axios from business code.
   `apps/notification-service/src/clients/auth-service.client.ts` is the reference.

   ```ts
   const accessToken = await this.serviceTokenProvider.getToken('auth-service', [ServiceScopeEnum.USERS_CONTACT_READ]);
   const response = await axios.get(`${this.authServiceUrl}/internal/users/${userId}/contact`, {
     headers: { Authorization: `Bearer ${accessToken}` },
     timeout: INTERNAL_HTTP_TIMEOUT_MS,
     maxRedirects: 0,
     validateStatus: () => true,
   });
   ```

What `ServiceTokenProvider.getToken(audience, scopes)` does:

- It caches one token per audience and scope set. A cached token is reused until 30 s before the
  `expiresIn` that auth-service returned.
- Concurrent requests for the same token share one HTTP call.
- It never returns an expired token, and never caches a malformed response.
- Every failure becomes `503 ServiceUnavailableException` for the caller. The log says why: network
  or timeout, `401` (credentials), `403` (audience or scope), `5xx`, or a malformed body. It never
  logs secrets or tokens.

A service token proves **which service** is calling, not which user it acts for. Never trust a
caller-supplied `X-User-Id` as authentication.

## Adding a scope, a client or an internal endpoint

- **A scope.** Add it to `ServiceScopeEnum` in `libs/src/lib/auth/auth.enum.ts`. Values are UPPERCASE,
  for example `TRIPS_READ`.
- **A client.** Add an entry to `SERVICE_CLIENTS` in
  `apps/auth-service/src/modules/service-client/service-client.constant.ts`:

  ```ts
  'trip-service': {
    secretVariable: 'TRIP_SERVICE_CLIENT_SECRET',
    audiences: ['auth-service'],
    scopes: [ServiceScopeEnum.USERS_CONTACT_READ],
  },
  ```

  Then add `TRIP_SERVICE_CLIENT_SECRET` to auth-service's env (validated with
  `@Matches(SERVICE_CLIENT_SECRET_PATTERN)`, in all four places). Generate the value with
  `openssl rand -hex 32` and put the same value in the caller's `SERVICE_CLIENT_SECRET`. auth-service
  fails to start if a registered client has no valid secret, or if a client lists a user or refresh
  audience.

- **An internal endpoint.** Put it in its own controller under `/internal/...`, with class-level
  `@RequireServiceScopes(...)`, `@ApiTags('internal')` and `@ApiBearerAuth()`. Raise its `@Throttle`
  limits, because the global per-IP buckets are sized for users. Return only the fields the caller
  needs. Keep user-facing and service-facing routes separate, even when they share a service method.

## Configuration

| Variable                             | auth-service                      | trip-service | notification-service                     |
| ------------------------------------ | --------------------------------- | ------------ | ---------------------------------------- |
| `SERVICE_NAME`                       | required                          | required     | required; must be `notification-service` |
| `JWT_PRIVATE_KEY_FILE`               | required                          | —            | —                                        |
| `JWT_PREVIOUS_PUBLIC_KEY_FILE`       | optional, rotation only           | —            | —                                        |
| `ACCESS_TOKEN_EXPIRES_IN_SECONDS`    | required, integer ≥ 60 (300)      | —            | —                                        |
| `REFRESH_TOKEN_EXPIRES_IN_SECONDS`   | required, integer ≥ 3600 (604800) | —            | —                                        |
| `SERVICE_TOKEN_EXPIRES_IN_SECONDS`   | required, integer ≥ 60 (300)      | —            | —                                        |
| `NOTIFICATION_SERVICE_CLIENT_SECRET` | required, 64 lowercase hex        | —            | —                                        |
| `AUTH_SERVICE_URL`                   | —                                 | required     | required                                 |
| `SERVICE_CLIENT_SECRET`              | —                                 | —            | required, 64 lowercase hex               |

`AUTH_SERVICE_URL` includes the global prefix, for example `http://localhost:7000/api`. Validation
rejects it unless it ends in `/api`, and clients append paths without one (`/.well-known/jwks.json`,
`/service-tokens`, `/internal/...`).

Key file paths are relative to the workspace root, like the services' `envFilePath`. Changing
`REFRESH_TOKEN_EXPIRES_IN_SECONDS` changes the session policy.

Each `SERVICE_NAME` doubles as that service's audience and, for a caller, its client id. A wrong
value fails closed: the token request gets 401 as an unknown client, or the receiver rejects the
`aud` with 401. That is only detected for interactions that exist; a service that takes part in no
service-token call gets no such check.

## Setup

```sh
npx nx run auth-service:generate-signing-key --name=jwt   # writes apps/auth-service/secrets/jwt.{private,public}.pem
openssl rand -hex 32                                       # one secret per service client
```

- Put `JWT_PRIVATE_KEY_FILE=apps/auth-service/secrets/jwt.private.pem` in auth-service's `.env`.
- Put the secret in `NOTIFICATION_SERVICE_CLIENT_SECRET` (auth-service) and `SERVICE_CLIENT_SECRET`
  (notification-service).

About `generate-signing-key`:

- It runs a ts-node script that uses Node's crypto, so neither openssl nor a shell is involved.
- The name must match `^[a-z0-9-]{1,64}$`, and files always go to `apps/auth-service/secrets/`.
- Files are written with mode `600` and never overwrite an existing key.
- If anything fails, it removes what it wrote.
- `apps/*/secrets/` is gitignored, and `.dockerignore` keeps it and every `.env` out of images.

## Key rotation and compromise

auth-service publishes the current key and, during a rotation, the previous one. `LocalKeyResolver`
and every verifier match keys by **exact `kid`** only.

How a verifier (`JwksKeyResolver`) caches keys:

- It fetches only the configured `${AUTH_SERVICE_URL}/.well-known/jwks.json`. It never follows a URL
  from a token header (`jku`, `x5u`) and never follows redirects.
- It caches the key set for 10 minutes. An unknown `kid` triggers a refetch, at most once per 30 s,
  and concurrent callers share one fetch.
- A successful fetch replaces the set, so keys no longer published are dropped. If that fetch still
  lacks the `kid`, the token gets **401**.
- If a fetch fails, a matching cached key may still be used while the set is under 1 hour old. After
  that, or with nothing cached, the request gets **503**.
- A failed or malformed fetch never replaces the last usable set.
- A document is rejected as a whole if it carries private key material (`d`, `p`, `q`, …), has no
  usable key, or repeats a `kid`. Single unusable keys (not RSA, `use` other than `sig`, `alg` other
  than `RS256`, under 2048 bits, no `kid`) are ignored.

### Routine rotation

1. `npx nx run auth-service:generate-signing-key --name=jwt-<date>`.
2. Point `JWT_PRIVATE_KEY_FILE` at the new `.private.pem` and `JWT_PREVIOUS_PUBLIC_KEY_FILE` at the
   old key's `.public.pem`. Restart auth-service.
   - The JWKS now lists both keys.
   - Verifiers fetch the new `kid` the first time they see it.
   - Tokens signed with the old key keep verifying.
3. After `REFRESH_TOKEN_EXPIRES_IN_SECONDS` (7 days), unset `JWT_PREVIOUS_PUBLIC_KEY_FILE` and restart.
   Tokens signed with the old key then get 401.

### Signing-key compromise

The 1-hour stale-key allowance is an availability trade-off, **not** a compromise response. Clear
every cache actively; don't wait for it to expire.

1. Generate a new key, point `JWT_PRIVATE_KEY_FILE` at it, and leave `JWT_PREVIOUS_PUBLIC_KEY_FILE`
   **unset**. Restart auth-service, which stops signing with the compromised key.
2. Confirm `/.well-known/jwks.json` lists **only** the new `kid` and stays reachable.
3. Restart **every instance** of every verifier.
   - The JWKS cache is in memory only, so a restarted process starts empty and cannot fall back to
     the old key.
   - If it cannot reach auth-service, it answers 503 and accepts nothing.
   - The procedure is done only when no unrestarted instance is still serving.
4. Keep each restarted instance out of traffic until it has fetched the new set: a token signed with
   the new key must get 200 or 403, not 503.
5. Check on every verifier, and on auth-service, that a token signed with the compromised key gets 401.
6. Every user signs in again, because refresh tokens signed with the compromised key no longer verify.

## Client secret rotation and disabling a client

- **Disable a client.** Remove its `SERVICE_CLIENTS` entry and restart auth-service. New tokens stop
  at once. Tokens already issued live up to `SERVICE_TOKEN_EXPIRES_IN_SECONDS` (300 s).
- **Rotate a client secret.** This is a coordinated single-secret change:
  1. Generate a new value and set it in both auth-service and the caller.
  2. Restart auth-service. The old secret stops working at once.
  3. Restart the caller. Its cached token covers up to 300 s of the gap.

  Zero-downtime rotation would need overlapping secrets per client, which is not built.

- **Leaked client secret.** Rotate it as above. Tokens already minted with it stay valid for up to
  300 s.

## Failure behaviour

| Situation                                                                       | Status                              |
| ------------------------------------------------------------------------------- | ----------------------------------- |
| Missing or malformed `Authorization` header                                     | 401                                 |
| Bad signature, wrong `iss` or `aud`, expired, malformed claims, unknown `kid`   | 401                                 |
| Wrong token type for the route                                                  | 401                                 |
| Stale `tokenVersion` or inactive user (auth-service routes and `/auth/refresh`) | 401                                 |
| Valid service token without every required scope                                | 403                                 |
| Valid access token without the required role                                    | 403                                 |
| Unknown client, wrong secret or malformed Basic header on `/service-tokens`     | 401, with `WWW-Authenticate: Basic` |
| Audience or scope outside the client's allowlist                                | 403                                 |
| JWKS unreachable and no eligible cached key                                     | 503                                 |
| Database error while validating a user                                          | 5xx, never 401                      |
| `@Public` or `@RequireServiceScopes` combined with `@Roles`                     | 500, logged as a misconfiguration   |

Clients never see verification details; they only get `Invalid access token`. Logs name the reason,
the principal, the audience and the scopes, never a token, secret, cookie or `Authorization` header.

## Code map

| Piece                                                               | Where                                                  |
| ------------------------------------------------------------------- | ------------------------------------------------------ |
| Contracts: enums, constants, interfaces, request typing             | `libs/src/lib/auth/auth.{enum,constant,interface}.ts`  |
| Decorators                                                          | `libs/src/lib/auth/auth.decorator.ts`                  |
| Verification                                                        | `libs/src/lib/auth/token-verifier.service.ts`          |
| JWKS fetch and cache                                                | `libs/src/lib/auth/jwks-key.resolver.ts`               |
| Guard (authentication and roles in one place)                       | `libs/src/lib/auth/authentication.guard.ts`            |
| Module                                                              | `libs/src/lib/auth/authentication.module.ts`           |
| Calling side                                                        | `libs/src/lib/auth/service-token.{provider,module}.ts` |
| Signing keys, JWKS endpoint, local resolver, key script             | `apps/auth-service/src/modules/signing-key/`           |
| Access and refresh tokens, `/auth/refresh`                          | `apps/auth-service/src/modules/auth/`                  |
| Client registry, `/service-tokens`                                  | `apps/auth-service/src/modules/service-client/`        |
| Internal contact route, `ActiveUserValidator`, `tokenVersion` bumps | `apps/auth-service/src/modules/users/`                 |
| Reference client                                                    | `apps/notification-service/src/clients/`               |
| Reference verifier wiring                                           | `apps/trip-service/src/app.module.ts`                  |

## Tests

- **Unit specs** use real RSA key pairs:
  - libs: verifier, resolver, guard, provider;
  - auth-service: signing keys, key script, Basic parser, client registry, refresh, validator,
    `tokenVersion` bumps;
  - notification-service: the client.
- **Integration spec:** `libs/src/lib/auth/spec/authentication.integration.spec.ts` starts a real
  Nest app with the real guard and a JWKS served over local HTTP.
- **End to end:** `apps/auth-service-e2e` covers login, refresh, logout, role-change and
  deactivation revocation, the service token flow, and the access matrix, against the running
  service.

Run them with `npx nx run-many -t lint,test,typecheck` and `npx nx e2e auth-service-e2e`.

## Limitations and production notes

- **Revocation window.** Other services accept a revoked access token for up to 300 s.
- **No delegation.** Service calls carry no user context. If a receiver must enforce a user's
  permissions, that needs a deliberate design; don't pass user ids in headers.
- **No TLS between services locally.** Across any untrusted network, use HTTPS: Basic credentials
  and bearer tokens must not cross a plaintext link.
- **Keep internal routes private.** `/api/internal/*` and `/api/service-tokens` must not be routed by
  any public ingress. The guard is the control; network isolation is an extra layer, not a
  replacement.
- **Secrets and keys.** Keep them out of git and images, restrict key file permissions, and prefer a
  secrets manager outside local development.
- **Kafka is plaintext and unauthenticated.** HTTP service tokens do not protect the event path.
- **Logging.** Nothing logs requests today. Any future HTTP or exception logging must redact
  `Authorization` headers, login, refresh and service-token bodies, and token responses.
