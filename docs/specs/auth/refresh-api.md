# Refresh Session API Spec

**Area:** Auth
**Status:** Implemented
**Last updated:** 2026-06-08

---

## Overview

Backend implementation for [UC-AUTH-7 (Silent session restoration on reload or direct navigation)](./login.md#uc-auth-7--silent-session-restoration-on-reload-or-direct-navigation) and the enabling mechanism behind [UC-AUTH-5 (Already-authenticated user visits `/login`)](./login.md#uc-auth-5--already-authenticated-user-visits-login):

- `POST /auth/refresh` — exchanges a valid, unexpired refresh-token cookie for a new session, rotating the refresh token in the process

This is the fourth and final session-issuing endpoint, completing the trio `register` → `verifyEmail`/`login` started: it returns the exact same `{ accessToken, user, account }` shape plus a rotated `HttpOnly` refresh cookie, so the client can apply one `routeForAccountStatus` rule regardless of which endpoint produced the session — exactly as [login-api.md](./login-api.md)'s Decisions table anticipated for `refresh`. Token mechanics (signing, hashing, rotation) follow [ADR 0002](../../adr/0002-custom-jwt-auth.md) and [ADR 0012](../../adr/0012-refresh-token-storage.md); the full decision record for *this* endpoint — rotation strategy, deferred reuse detection, and where the silent-refresh attempt lives client-side — is [ADR 0017](../../adr/0017-refresh-token-rotation.md).

---

## POST /auth/refresh

### Request

```
POST /auth/refresh
Cookie: refreshToken=<opaque token>
```

No request body, and no `Authorization` header — the credential *is* the `HttpOnly` refresh-token cookie. `apiFetch`'s `credentials: "include"` ensures it travels automatically; client code never reads or constructs it directly (it can't — it's `HttpOnly`).

### Responses

| Status | Body | When |
|---|---|---|
| 200 | `{ "accessToken": "...", "accessTokenExpiresAt": "2026-06-13T12:34:56.000Z", "user": { "id": "...", "accountId": "...", "role": "owner" }, "account": { "id": "...", "status": "ONBOARDING" \| "ACTIVE" } }` | Cookie present, hash matches a live `RefreshToken` row, not expired — session re-issued and rotated |
| 401 | `{ "error": "Invalid or expired session" }` | Cookie missing, hash not found (garbage, already rotated, or forged), or the matched row's `expiresAt` has passed |
| 500 | `{ "error": "Internal server error" }` | Unexpected failure |

On a 200 response, the server sets a **new** rotated refresh-token cookie — identical attributes to `login`/`verifyEmail`:

```
Set-Cookie: refreshToken=<new token>; HttpOnly; Secure; SameSite=Strict; Path=/
```

No `Max-Age` — session cookie (expires on browser close); the new `RefreshToken` DB record carries a fresh 7-day `expiresAt`.

### Side effects

1. Read the `refreshToken` cookie; if absent, fail with 401 before touching the database (no hash to look up)
2. Hash the raw token (`hashRefreshToken` — SHA-256, [ADR 0012](../../adr/0012-refresh-token-storage.md)) and look it up via `refreshTokenRepo.findByTokenHash`
3. If no row matches, or the matched row's `expiresAt` has passed, fail with 401 — see [ADR 0017](../../adr/0017-refresh-token-rotation.md) ("Reuse detection") for why these are deliberately indistinguishable from each other and from "no cookie"
4. **Rotate**: delete the matched row (`deleteById`) and generate + persist a new one (`generateRefreshToken` + `refreshTokenRepo.create`) — matches [ADR 0012](../../adr/0012-refresh-token-storage.md)'s "delete the old row, insert a new one"
5. Look up the `User` by the matched row's `userId` (`userRepo.findById` — new repository method, see Decisions) and the `User`'s `Account` (`accountRepo.findById`), exactly as `login`/`verifyEmail` do
6. Issue a new access token (`signAccessToken` — same payload shape: `sub`, `accountId`, `role`, 15 min TTL)

### Client behaviour after 200

Identical to every other session-issuing endpoint: store `accessToken`/`user`/`account` in `AuthProvider`'s in-memory `session` (never `localStorage` — [ADR 0002](../../adr/0002-custom-jwt-auth.md)). Unlike `login`/`verifyEmail`/`register`, this call is **not** triggered by a User action — it's an effect `AuthProvider` fires once on mount, attempting to silently restore a session the User never noticed they'd lost. There is no redirect tied directly to a 200 here; the screen that was already rendering (or about to render) simply gets a populated `session` and proceeds normally. The one exception is `/login` itself: a 200 here means the visitor is already signed in, and UC-AUTH-5 routes them onward via `routeForAccountStatus(account.status)` instead of showing the form.

### Client behaviour after 401

`session` stays `null`. This is expected and silent — there is no error UI for a failed silent refresh; it simply means "this visitor is not signed in," and every screen's existing no-session handling takes over (e.g. the garage screen's redirect to `/login` — [garage-screen.md](../garage/garage-screen.md), "No-session redirect"). `AuthProvider` does not log this as an error; a visitor with no cookie is the overwhelmingly common case for this endpoint (every fresh visit to `/login` triggers it) and logging it would be noise, not signal.

---

## Acceptance Criteria

- [x] `POST /auth/refresh` with a valid, unexpired `refreshToken` cookie returns 200 with `{ accessToken, accessTokenExpiresAt, user, account }`, matching the `login`/`verifyEmail` response shape exactly (the `accessTokenExpiresAt` ISO timestamp powers proactive client refresh — see [token-refresh.md](./token-refresh.md), [ADR 0021](../../adr/0021-proactive-access-token-refresh.md))
- [x] On success, the old `RefreshToken` row is deleted and a new one is created (rotation) — the old raw token can no longer be used
- [x] On success, the response sets a **new** `refreshToken` cookie with attributes identical to `login`/`verifyEmail` (`HttpOnly`, `Secure` in production, `SameSite=Strict`, `Path=/`, no `Max-Age`)
- [x] `POST /auth/refresh` with no `refreshToken` cookie returns 401 without querying the database
- [x] `POST /auth/refresh` with a cookie whose hash matches no `RefreshToken` row returns 401
- [x] `POST /auth/refresh` with a cookie matching an expired `RefreshToken` row returns 401
- [x] All 401 cases return the same status, body, and message — the client cannot distinguish "no cookie" from "expired" from "forged/already rotated" (mirrors `login`'s single-401 precedent — see [login-api.md](./login-api.md) Decisions)
- [x] Issued access token payload matches the `verifyEmail`/`login`-issued shape (`sub`, `accountId`, `role`)
- [x] `AuthProvider` calls `POST /auth/refresh` once on mount when `session` is `null`, and exposes `isRestoring: boolean` so consumers can distinguish "still checking" from "confirmed logged out"
- [x] On a successful silent refresh, a reloaded or directly-navigated protected screen (e.g. `/garage`) renders normally — no redirect to `/login`, no flash of a logged-out state
- [x] On a failed silent refresh (no valid cookie), the screen's existing no-session handling runs only after `isRestoring` becomes `false` — never before
- [x] An already-authenticated visitor to `/login` (silent refresh succeeds on mount) is redirected via `routeForAccountStatus(account.status)` once the restore confirms a session (UC-AUTH-5) — the form can be visible for the brief duration of that request first; see [login.md](./login.md)'s "Route protection" note on why that flash is left as-is

### E2E tests (Cypress)

- [x] Reloading `/garage` with a valid refresh-token cookie restores the session silently and renders the populated garage — no redirect to `/login`
- [x] Reloading `/garage` with no valid refresh-token cookie (silent refresh fails) still redirects to `/login`, exactly as the existing "session lost on reload" spec covers
- [x] Visiting `/login` with a valid refresh-token cookie redirects to the account-status-appropriate destination instead of rendering the sign-in form

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Rotation mechanism | Delete the matched `RefreshToken` row, then create a new one | Matches [ADR 0012](../../adr/0012-refresh-token-storage.md)'s stated design exactly; keeps the "is this token valid" read and the "replace it" write as separate, individually-testable steps rather than one conditional `UPDATE` |
| Single 401 for "no cookie," "not found," and "expired" | Same status, body, and message for all three | Same reasoning `login` already applies to its catch-all 401 ([login-api.md](./login-api.md) Decisions) — and here it additionally hides whether a *given* cookie value was ever valid, which is exactly the ambiguity [ADR 0017](../../adr/0017-refresh-token-rotation.md) accepts in lieu of full reuse detection |
| Reuse `verifyEmail`/`login`'s token-issuance code path | Same `signAccessToken` + `generateRefreshToken` + `refreshTokenRepo`/`accountRepo` calls, same cookie options, same response shape | Identical rationale to `login-api.md`'s "Reuse `verifyEmail`'s token-issuance code path" — one "issue a session" implementation, four callers |
| New `IUserRepository.findById` | Added alongside the existing `findByEmail`/`findByVerificationToken` lookups | `refresh` is the first session-issuing path that starts from a `RefreshToken` row (which carries `userId`, not an email or verification token) — every existing lookup method assumes a different starting point. A thin `findById` closes that gap without overloading an existing method's contract |
| No request body / no `Authorization` header | The `refreshToken` cookie is the sole credential | This is what makes the call *silent* — `apiFetch`'s `credentials: "include"` sends the `HttpOnly` cookie automatically; there is nothing for client code to read, hold, or attach. Requiring an explicit token would defeat the purpose (the access token is exactly what's missing when this endpoint needs to be called) |
| Logging on 401 | `logger.warn`-level via the existing `errorMiddleware` path (no extra logging in the service) | A failed silent refresh is the expected outcome for every fresh, never-signed-in visitor — logging it as a notable event would drown real signal in noise. The existing `AppError` → `errorMiddleware` → `logger.warn` path already captures it at the right level for anyone who needs to audit auth failures |

---

## Out of scope

- **Full token reuse detection and mass session revocation** — ADR 0012 names the ideal ("hash not found → revoke all sessions for that User"); [ADR 0017](../../adr/0017-refresh-token-rotation.md) explains why it's deferred (requires retaining rotated-token provenance, a schema change beyond this endpoint's scope) and tracks it as a V2+ item
- `POST /auth/logout` — named alongside `refresh` in ADR 0012 as completing the session model; a separate endpoint with its own spec
- Rate limiting on the refresh endpoint (V2, same deferral rationale as [register-api.md](./register-api.md)'s and [login-api.md](./login-api.md)'s)
- "Remember me" / persistent sessions — a config change to `expiresAt`, not a schema or endpoint change (V2 — see [login.md](./login.md#v2-roadmap-items))
