# Permissions

Who may call each route, and on whose data. Authentication itself (tokens, the guard, service
scopes) is in [`authentication.md`](authentication.md); this page is about **authorization**:
roles, ownership, and an admin acting for a user.

## Contents

- [How it works today](#how-it-works-today)
- [Matrix](#matrix)
  - [auth-service](#auth-service)
  - [trip-service](#trip-service)
  - [vehicle-service](#vehicle-service)
  - [notification-service](#notification-service)
  - [audit-service](#audit-service)
- [Planned: action-based permissions](#planned-action-based-permissions)

## How it works today

Three layers, each in one place:

| Layer     | Where                                                   | Answers                               | Failure                                   |
| --------- | ------------------------------------------------------- | ------------------------------------- | ----------------------------------------- |
| Role      | `@Roles(...)` on the route, checked by the global guard | may this **kind** of user call it?    | 403                                       |
| Ownership | a `can…` / `is…` function in `<module>.policy.ts`       | may **this** user touch **this** row? | 404, so a stranger learns nothing         |
| State     | an `assert…` function in `<module>.policy.ts`           | may the row make this move **now**?   | 409 (403 when the role may never make it) |

The service fetches the row (locked when it writes), asks the policy, then writes. Services never
compare `user.role` or owner ids inline; `prepareListWhere` is the one place that scopes by role.

### An admin acting for a user

Admins run the platform, so most user routes also allow `ADMIN`:

- **Creating for someone:** the body takes an optional target id (`customerId` on a trip,
  `driverId` on an offer or a vehicle). The policy (`resolveTargetUserId` in `trip.policy.ts`,
  `resolveDriverId` in `vehicle.policy.ts`) makes it **required for an admin** (400) and **only
  the caller's own id** for anyone else (403).
- **Checking the target:** the service checks an admin-named user against its own copy of
  `auth.user-changed` (trip-service's `users`, vehicle-service's `drivers`): unknown or wrong role
  → 404, deactivated → 409. A user acting for themselves is not looked up: the token already
  proves who they are, and the copy may lag a new account by a moment.
- **Acting on an existing row:** the ownership policy lets an admin through (`isTripParticipant`,
  `canManageTripOffers`, `canWithdrawOffer`, `canAccessVehicle`), and the transition tables give
  `ADMIN` every move a customer or driver can make.
- **Audit:** the actor recorded in history, events and the audit trail is the **admin**, never the
  user they acted for.

## Matrix

Cells: **own** = the caller's own rows; **assigned** = trips the driver was assigned; **any** =
every row; **for** = acting for a named user; **—** = forbidden (403). Routes are under `/api`.

### auth-service

| Route                             | CUSTOMER | DRIVER | ADMIN | Other                         |
| --------------------------------- | -------- | ------ | ----- | ----------------------------- |
| `POST /auth/register`             |          |        |       | public                        |
| `POST /auth/login`                |          |        |       | public                        |
| `POST /auth/refresh`              |          |        |       | public, refresh token         |
| `POST /auth/forgot-password`      |          |        |       | public                        |
| `POST /auth/reset-password`       |          |        |       | public, reset token           |
| `POST /auth/change-password`      | own      | own    | own   |                               |
| `GET /auth/me`                    | own      | own    | own   |                               |
| `POST /auth/logout`               | own      | own    | own   |                               |
| `GET /users`                      | —        | —      | any   |                               |
| `GET /users/:id`                  | —        | —      | any   |                               |
| `POST /users`                     | —        | —      | any   |                               |
| `PATCH /users/:id`                | —        | —      | any   |                               |
| `PATCH /users/:id/status`         | —        | —      | any   |                               |
| `POST /users/:id/logout`          | —        | —      | any   |                               |
| `DELETE /users/:id`               | —        | —      | any   |                               |
| `GET /internal/users/:id/contact` | —        | —      | —     | service, `USERS_CONTACT_READ` |
| `POST /service-tokens`            |          |        |       | public, client credentials    |
| `GET /.well-known/jwks.json`      |          |        |       | public                        |

### trip-service

| Route                                     | CUSTOMER         | DRIVER                  | ADMIN            |
| ----------------------------------------- | ---------------- | ----------------------- | ---------------- |
| `POST /trips`                             | own              | —                       | for customer     |
| `GET /trips`                              | —                | —                       | any              |
| `GET /trips/me`                           | own              | assigned                | —                |
| `GET /trips/open`                         | —                | any open, no recipient  | any open         |
| `GET /trips/:id`                          | own              | assigned, or any open   | any              |
| `GET /trips/:id/history`                  | own              | assigned                | any              |
| `PATCH /trips/:id/vehicle-type`           | own              | —                       | any              |
| `POST /trips/:id/cancel`                  | own, until start | assigned, once accepted | any, until start |
| `POST /trips/:id/arrived`                 | —                | assigned                | for driver       |
| `POST /trips/:id/start`                   | —                | assigned                | for driver       |
| `POST /trips/:id/complete`                | —                | assigned                | for driver       |
| `POST /trips/:tripId/offers`              | —                | own                     | for driver       |
| `GET /trips/:tripId/offers`               | own trip         | —                       | any              |
| `POST /trips/:tripId/offers/:id/accept`   | own trip         | —                       | for customer     |
| `POST /trips/:tripId/offers/:id/withdraw` | —                | own offer               | for driver       |

State rules (409) come from `TRIP_TRANSITIONS` and the policies: a vehicle type changes only
while the trip is REQUESTED, unexpired and has no pending offer; an offer needs a REQUESTED,
unexpired trip and a driver without an active trip.

### vehicle-service

| Route                                     | CUSTOMER | DRIVER | ADMIN      |
| ----------------------------------------- | -------- | ------ | ---------- |
| `POST /vehicles`                          | —        | own    | for driver |
| `GET /vehicles`                           | —        | —      | any        |
| `GET /vehicles/me`                        | —        | own    | —          |
| `GET /vehicles/:id`                       | —        | own    | any        |
| `PATCH /vehicles/:id`                     | —        | own    | any        |
| `DELETE /vehicles/:id`                    | —        | own    | any        |
| `PATCH /vehicles/:id/verification-status` | —        | —      | any        |
| `PATCH /vehicles/:id/operational-status`  | —        | —      | any        |

### notification-service

| Route                                            | CUSTOMER | DRIVER | ADMIN            |
| ------------------------------------------------ | -------- | ------ | ---------------- |
| `GET /notifications/me`                          | own      | own    | own              |
| `GET /notifications/me/unread-count`             | own      | own    | own              |
| `POST /notifications/me/read-all`                | own      | own    | own              |
| `PATCH /notifications/me/:id/read`               | own      | own    | own              |
| `PATCH /notifications/me/:id/unread`             | own      | own    | own              |
| `DELETE /notifications/me/:id`                   | own      | own    | own              |
| `GET /notifications/me/preferences`              | own      | own    | own              |
| `PUT /notifications/me/preferences`              | own      | own    | own              |
| `GET /notifications/users/:userId/preferences`   | —        | —      | for user         |
| `PUT /notifications/users/:userId/preferences`   | —        | —      | for user         |
| `GET /admin/notifications/deliveries`            | —        | —      | any              |
| `POST /admin/notifications/deliveries/:id/retry` | —        | —      | any, FAILED only |

An admin reads what a user was sent through the deliveries log, not their inbox.

### audit-service

| Route                   | CUSTOMER | DRIVER | ADMIN |
| ----------------------- | -------- | ------ | ----- |
| `GET /admin/audits`     | —        | —      | any   |
| `GET /admin/audits/:id` | —        | —      | any   |

## Planned: action-based permissions

Today a role is a fixed bundle of rights, and every admin can do everything above. That stops
working once there are different kinds of staff (support, finance, operations) or a customer
who is also a driver. The plan replaces `@Roles` with permissions, without changing the policy
layer.

### Design

- **Permissions** are a `PermissionEnum` in `libs/auth`, named `<RESOURCE>_<ACTION>_<SCOPE>`:
  `TRIP_CREATE_OWN`, `TRIP_CREATE_ANY`, `TRIP_CANCEL_ANY`, `VEHICLE_VERIFY_ANY`,
  `USER_DEACTIVATE_ANY`. `OWN` means the caller's own rows; `ANY` means any row, including acting
  for a named user.
- **Roles map to permissions** in one `ROLE_PERMISSIONS` constant in `libs/auth`, so a role is
  only a named bundle. Admin sub-roles (`SUPPORT`, `FINANCE`, `OPERATIONS`) are new bundles,
  not new code paths.
- **Routes declare what they need:** `@RequirePermissions(PermissionEnum.TRIP_CREATE_OWN,
PermissionEnum.TRIP_CREATE_ANY)` means "either one". The existing `AuthenticationGuard` checks
  it, as it checks `@Roles` today, and still fails closed on a misconfigured route.
- **Policies ask about permissions, not roles:** `actsForAnotherUser(user)` becomes "has
  `TRIP_CREATE_ANY`"; `isTripParticipant` becomes "has `TRIP_READ_ANY`, or owns it". The 404 /
  403 / 409 rules above stay.
- **Audit** records the permission used next to the actor, so a trail shows _why_ an admin was
  allowed.

### Steps

1. Add `PermissionEnum`, `ROLE_PERMISSIONS` and `@RequirePermissions` to `libs/auth`; the guard
   accepts either decorator during the move.
2. Give `AuthenticatedUser` a `permissions` set, derived from `role` through `ROLE_PERMISSIONS`
   when the token is verified.
3. Move one service at a time: replace `@Roles` with `@RequirePermissions`, and role checks in
   its policies with permission checks. Specs assert the permissions of every route, as they
   assert roles today.
4. Remove `@Roles` once no route uses it.
5. Add admin sub-roles in auth-service (a role column change, migration, `auth.user-changed`),
   then split the admin bundle.

### Open questions

- **In the token or looked up?** Deriving permissions from `role` keeps tokens small and needs
  no lookup, but per-user grants would need either a `permissions` claim (larger tokens, and a
  change takes up to 5 minutes to reach other services, like a role change today) or a lookup
  per request.
- **Per-user grants:** whether any user ever needs a permission outside their role's bundle. If
  not, roles-to-permissions in code is enough.
- **Customer and driver in one account:** whether one user can hold both roles, which the
  current single `role` column does not allow.
