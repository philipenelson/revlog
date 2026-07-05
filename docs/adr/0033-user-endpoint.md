# Authenticated `GET /users/me` endpoint + offline-cached mobile profile

## Context

The mobile Settings screen (`docs/specs/mobile-app/settings.md`, UC-MOB-SETTINGS-1) shows the signed-in Owner's display name and email in a read-only Account section. Nothing in the client can supply that data today:

- The `Session` returned by `POST /auth/login` / `/auth/refresh` carries only `user.{id, accountId, role}` and `account.{id, status}` — no `fullName`, no `email`.
- There is no account/profile endpoint in the API, and no local cache of the record on either client (the web app has no account or settings page at all).

So the client has an authenticated user whose own name and email it cannot read back.

## Decision

**1. Add `GET /users/me`** — an authenticated alias for "the current user," identified by the access token:

```
GET /users/me        (Authorization: Bearer <accessToken>)
200 → { "id": "...", "fullName": "...", "email": "...", "role": "OWNER" }
401 → missing/invalid token
404 → token valid but the user row no longer exists
```

`passwordHash`, verification tokens, and timestamps are never returned. The route reads `req.auth.sub` (set by `authenticate`) — there is **no id in the path**, so it is structurally incapable of returning another user's record (no IDOR surface, no ownership guard to get wrong). `GET /users/:id` — with a self-or-admin authorization guard — is reserved for the V2 admin "manage users in an account" use case as a *separate* route.

Implementation mirrors the existing `POST /onboarding/skip` slice:

- `apps/api/src/services/user.service.ts` — `getUser(userId)` → `PrismaUserRepository.findById`, maps to the public shape, throws `AppError(404)` when absent.
- `apps/api/src/routes/users.ts` — `createUsersRouter(userService)`, `GET /me` behind `authenticate`.
- Registered in `apps/api/src/app.ts` as `app.use('/users', ...)`.
- `packages/api-client` gains `getCurrentUser(client)` returning a `UserProfile`, used by `SyncService`.

**2. The mobile profile is offline-first cached, not online-only.** The Owner's name/email is cached in local SQLite and displayed even when offline (stale is preferred over a loading/unavailable state):

- New single-row `userProfile` table + `ProfileRepository` (`get()` / `save()`), same `Store<T>` pattern as the vehicle/log-entry caches.
- `SyncService.pull()` fetches `GET /users/me` and upserts the row — network I/O stays in SyncService per the offline-first rules; it is a read-only pull, so **no outbox** entry is involved.
- The Settings viewmodel reads the profile from `ProfileRepository` (offline-first read), never calling the API directly.

## Status

accepted

## Consequences

- The Account section renders immediately from cache and survives going offline, refreshing on the next sync — consistent with the Garage list's offline-first behavior.
- **Editing name/email/password is out of scope here and stays out.** Those are sensitive mutations that will require the user to be online and go through their own OTP confirmation flow (future work); the cached profile is display-only. So the local cache is never user-mutated and never enqueues an outbox entry.
- **Forward path to V2 admin.** `GET /users/me` is the self alias; `GET /users` (list) and `GET /users/:id` (with a self-or-admin guard) extend the same plural resource for account-level user management later. Plural `/users` matches the repo's `/vehicles` convention.

## V2+ items

- `GET /users`, `GET /users/:id`, invite/remove users → V2 admin (account-level user management).
- Self-service name/email/password editing via an online OTP-confirmed flow → future (own spec).
