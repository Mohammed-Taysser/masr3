# Swagger UI and Postman

How to call the masr3 APIs by hand: Swagger UI, which every service serves, and the Postman
collections generated from it. Token types and route protection are covered in
[Authentication](authentication.md); this guide is only about using them from these two tools.

## Contents

- [Swagger UI](#swagger-ui)
- [Authorizing in Swagger UI](#authorizing-in-swagger-ui)
- [Service credentials (basic)](#service-credentials-basic)
- [Where the Swagger auth comes from](#where-the-swagger-auth-comes-from)
- [Postman collections](#postman-collections)
- [Using the collections in Postman](#using-the-collections-in-postman)
- [How the generator works](#how-the-generator-works)

## Swagger UI

| Service                | UI                               | OpenAPI JSON                          |
| ---------------------- | -------------------------------- | ------------------------------------- |
| `auth-service`         | `http://localhost:7000/api/docs` | `http://localhost:7000/api/docs-json` |
| `notification-service` | `http://localhost:7001/api/docs` | `http://localhost:7001/api/docs-json` |
| `trip-service`         | `http://localhost:7002/api/docs` | `http://localhost:7002/api/docs-json` |
| `audit-service`        | `http://localhost:7003/api/docs` | `http://localhost:7003/api/docs-json` |

Routes are grouped by tag. auth-service puts its service-only routes (`/service-tokens`,
`/internal/...`) under the `internal` tag. A route with a 🔒 needs credentials; a route without one
is public.

## Authorizing in Swagger UI

The **Authorize** button opens a dialog with one entry per security scheme:

| Entry                   | Shown on          | Asks for            | Sends                                            |
| ----------------------- | ----------------- | ------------------- | ------------------------------------------------ |
| `bearer (http, Bearer)` | every service     | a token             | `Authorization: Bearer <token>`                  |
| `basic (http, Basic)`   | auth-service only | username + password | `Authorization: Basic base64(username:password)` |

Each entry reads _name (type, scheme)_:

- **name** (`bearer`, `basic`) is the name the scheme is registered under in `main.ts`.
- **type** `http` means the credential travels in the standard HTTP `Authorization` header.
  OpenAPI's other types are `apiKey` (a custom header, query or cookie), `oauth2` and
  `openIdConnect`; masr3 uses neither.
- **scheme** (`Bearer`, `Basic`) is what goes in that header: a token, or a username and password.

### What Authorize does

Authorize only **stores** the credential in the page. Nothing is sent and nothing visible changes.
The credential is attached later, when you **Try it out → Execute** a route that has a 🔒. To check
it was sent, look at the `curl` command Swagger UI shows above the response: it includes
`-H 'Authorization: Bearer …'`.

### Calling a protected route

1. Open auth-service's Swagger (`:7000/api/docs`) and execute `POST /api/auth/login` with a seeded
   user (`npx nx run auth-service:seed`). Every seeded user's password is `ChangeMe123!`.

   | Role     | User                   |
   | -------- | ---------------------- |
   | ADMIN    | `admin@masr3.local`    |
   | CUSTOMER | `customer@masr3.local` |
   | DRIVER   | `rider@masr3.local`    |

2. Copy `accessToken` from the response.
3. Open the Swagger page of the service you want to call, click **Authorize**, paste the token into
   `bearer` and click **Authorize**.
4. Execute the route.

### Common mistakes

| Symptom                                | Cause                                                                                                                                   |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 401 although you authorized            | You pasted `Bearer eyJ…`. Paste the token alone; Swagger UI adds the `Bearer` prefix itself, so the header became `Bearer Bearer eyJ…`. |
| 401 on another service's page          | Each service's Swagger page is a separate page. Authorize on every page you use.                                                        |
| 401 after reloading the page           | The stored token is lost on reload. Authorize again.                                                                                    |
| 401 after a few minutes                | Access tokens live 300 s. Log in again, or call `POST /api/auth/refresh` with the `refreshToken`.                                       |
| 403                                    | The token is valid but its role is not allowed on the route, e.g. a CUSTOMER on `/api/admin/...`. Log in as a user with the role.       |
| No `Authorization` in the shown `curl` | The route has no 🔒: it is public, or its controller lacks `@ApiBearerAuth()` (see below).                                              |

## Service credentials (basic)

The username and password in the `basic` entry are **not** a user's login. They are a _service's_
client credentials, used by exactly one route, `POST /api/service-tokens`, which one service calls to
get a token for calling another:

- **username**: the calling service's `SERVICE_NAME`. Today the only registered client is
  `notification-service`.
- **password**: that client's secret, `NOTIFICATION_SERVICE_CLIENT_SECRET` in auth-service's `.env`.

The request body names the receiving service and the scopes, e.g.
`{ "audience": "auth-service", "scopes": ["USERS_CONTACT_READ"] }`. The response holds a **service
token**. Authorize with it under `bearer` to call the `/internal/...` routes; a user's access token is
rejected there. The rules are in [Authentication → Calling another service](authentication.md#calling-another-service).

## Where the Swagger auth comes from

Each service's `main.ts` registers the schemes on the `DocumentBuilder`; controllers mark which
routes use them:

```ts
// main.ts: defines the scheme and adds the Authorize button
new DocumentBuilder().addBearerAuth(
  { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
  'bearer',
);

// a controller or route: puts the 🔒 on it and makes Swagger UI send the token
@ApiBearerAuth() // the default name is 'bearer'
```

auth-service also has `.addBasicAuth({ type: 'http', scheme: 'basic' }, 'basic')`, used by
`@ApiBasicAuth()` on `/service-tokens`. `bearerFormat: 'JWT'` is only a label in the UI.

The decorators only document. The `AuthenticationGuard` protects every route regardless. So a
protected controller **without** `@ApiBearerAuth()` still demands a token, but Swagger UI never sends
one and every call from Swagger fails with 401. Give every protected controller `@ApiBearerAuth()`.

## Postman collections

```sh
npx nx run postman:generate
```

It writes one collection per service and one combined collection:

```text
dist/postman/
  masr3.postman_collection.json              all services, one folder each
  collections/
    audit-service.postman_collection.json
    auth-service.postman_collection.json
    notification-service.postman_collection.json
    trip-service.postman_collection.json
```

The services must be **running** (`npx nx run-many -t serve`): the generator reads each spec from
`/api/docs-json`. It goes through every service and prints what it did:

```text
Postman collections (dist/postman)

  CREATED  audit-service         3 requests → dist/postman/collections/audit-service.postman_collection.json
  CREATED  auth-service          18 requests → dist/postman/collections/auth-service.postman_collection.json
  SKIPPED  notification-service  not running on http://localhost:7001
  CREATED  trip-service          14 requests → dist/postman/collections/trip-service.postman_collection.json

Created 3, skipped 1, failed 0
Combined 3 services, 35 requests → dist/postman/masr3.postman_collection.json
```

| Status  | Reason shown                              | Meaning                                                        |
| ------- | ----------------------------------------- | -------------------------------------------------------------- |
| SKIPPED | `no Swagger setup in main.ts`             | `main.ts` never calls `SwaggerModule.setup`                    |
| SKIPPED | `no .env, so no PORT` / `no PORT in .env` | the generator cannot tell where the service listens            |
| SKIPPED | `not running on http://localhost:<port>`  | start the service and run again                                |
| SKIPPED | `/api/docs-json returned <status>`        | something answers on the port, but it serves no spec           |
| FAILED  | the converter's reason                    | the spec could not be converted; the command exits with code 1 |

Skips are not errors and leave the exit code at 0. A skipped service keeps its collection file from
an earlier run, and the combined collection holds only the services created in this run. `dist/` is
gitignored: regenerate after an API change rather than committing the files.

## Using the collections in Postman

1. **Import** (_File → Import_) either `masr3.postman_collection.json` or the files in
   `collections/`. Folders follow the Swagger tags. Request bodies are filled from the
   `@ApiProperty({ example })` values, so login already has `customer@masr3.local`.
2. Create an **environment** (e.g. `masr3 local`) and select it. Set the variables you need:

   | Variable                                                                                                    | Where it is set            | Value                                                              |
   | ----------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------ |
   | `auth_service_base_url`, `notification_service_base_url`, `trip_service_base_url`, `audit_service_base_url` | the collection (generated) | `http://localhost:<PORT>` from the service's `.env`                |
   | `bearer_token`                                                                                              | your environment           | an access token from login, or a service token for `/internal/...` |
   | `basic_auth_username`, `basic_auth_password`                                                                | your environment           | client credentials for `/service-tokens` (see above)               |

3. Run **Auth → login**, copy `accessToken` into `bearer_token`, and call any protected request.

Variables are snake_case and the base URL is named per service. In Postman an environment variable
overrides a collection variable of the same name, so one environment can point every service
somewhere else (e.g. a staging host) by setting its `<service>_base_url`. A single shared `base_url`
would point all of them at one host. The same names are used in the per-service and combined
collections, so one environment works with either.

## How the generator works

For each folder in `apps/` that has `src/main.ts` (e2e projects have none), the generator:

1. checks that `main.ts` calls `SwaggerModule.setup`;
2. reads `PORT` from the service's `.env`;
3. fetches `http://localhost:<PORT>/api/docs-json`;
4. converts it with [`openapi-to-postmanv2`](https://github.com/postmanlabs/openapi-to-postman)
   (`convertV2`, folders by tag, parameters from examples);
5. renames the converter's variables to snake_case (`baseUrl` to `<service>_base_url`,
   `bearerToken` to `bearer_token`, `basicAuthUsername` / `basicAuthPassword` to
   `basic_auth_username` / `basic_auth_password`) and sets the base URL;
6. writes the service's collection, then merges the created ones into the combined collection.

| File                                                                                      | Holds                                          |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------- |
| [`generate-postman-collections.ts`](../tools/postman/src/generate-postman-collections.ts) | the steps above and the summary                |
| [`postman.constant.ts`](../tools/postman/src/postman.constant.ts)                         | paths, converter options, the variable renames |
| [`postman.enum.ts`](../tools/postman/src/postman.enum.ts)                                 | `CollectionStatusEnum`                         |
| [`postman.interface.ts`](../tools/postman/src/postman.interface.ts)                       | the result and collection shapes               |
| [`project.json`](../tools/postman/project.json)                                           | the `generate` and `typecheck` targets         |

A new service needs nothing here: it is picked up as soon as it has `src/main.ts`, Swagger and a
`PORT`. If a newer converter version adds a variable, it keeps the converter's camelCase name until
it is added to `CONVERTER_VARIABLE_RENAMES`.
