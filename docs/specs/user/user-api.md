# Current-User API Spec

**Area:** User
**Status:** Planned
**Last updated:** 2026-07-05

---

## Overview

Backend implementation for UC-MOB-SETTINGS-1 (Owner views account information) from
[`docs/specs/mobile-app/settings.md`](../mobile-app/settings.md):

- `GET /users/me` — returns the **current** user's public profile, identified by the access token.

The mobile client caches the result locally and displays it offline (see the settings spec). Authentication uses the
existing `authenticate` middleware (Bearer access token, custom JWT — [ADR 0002](../../adr/0002-custom-jwt-auth.md)).
See [ADR 0033](../../adr/0033-user-endpoint.md) for why this is `/users/me` (id-less self alias) rather than
`/users/:id`, and how it leaves room for V2 admin user-management routes.

---

## GET /users/me

### Request

```
GET /users/me
Authorization: Bearer <accessToken>
```

No body, no query params, no path params — the user is resolved from `req.auth.sub`.

### Responses

| Status | Body | When |
|---|---|---|
| 200 | `{ "id": "...", "fullName": "...", "email": "...", "role": "OWNER" }` | Token valid, user found |
| 401 | `{ "error": "Missing or invalid authorization header" }` / `{ "error": "Invalid or expired access token" }` | No/!Bearer header, or token invalid/expired |
| 404 | `{ "error": "User not found" }` | Token valid but the user row no longer exists (e.g. deleted) |
| 500 | `{ "error": "Internal server error" }` | Unexpected failure |

`passwordHash`, `verificationToken`, `verificationTokenExpiresAt`, and timestamps are **never** returned.

### Side effects

None (read-only). Steps:

1. `authenticate` verifies the Bearer access token and sets `req.auth = { sub, accountId, role }`.
2. `userService.getUser(req.auth.sub)` → `PrismaUserRepository.findById(sub)`.
3. Map the `User` to the public shape (`id`, `fullName`, `email`, `role`); throw `AppError(404)` if the row is absent.

---

## Acceptance Criteria

- [ ] `GET /users/me` with a valid token returns 200 and `{ id, fullName, email, role }`
- [ ] The response never includes `passwordHash` or any verification/token/timestamp field
- [ ] Missing or malformed `Authorization` header returns 401 (service not called)
- [ ] A valid token whose user row is gone returns 404
- [ ] Unexpected service errors surface as 500 via the global error middleware
- [ ] `user.service.getUser` and the route handler each have Vitest unit tests (happy path + guard clauses)

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Path | `GET /users/me` | Id-less self alias — no IDOR surface, no ownership guard to get wrong; plural `/users` matches `/vehicles`. See ADR 0033 |
| Other-user access | Not in V1 | `GET /users/:id` (self-or-admin guard) is a separate route reserved for V2 admin user management |
| Editing | Not here | Name/email/password changes are sensitive, online-only, OTP-confirmed flows — own future spec |

---

## Out of scope

- `PATCH /users/me` (self-service profile editing) → future, online + OTP
- `GET /users`, `GET /users/:id`, invite/remove users → V2 admin
