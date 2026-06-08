# Silent session restoration via `POST /auth/refresh` and token rotation

## Context

[ADR 0016](./0016-client-session-and-route-protection.md) shipped `AuthProvider` as a purely in-memory session store and named the resulting gap explicitly: *"No session restoration on reload, yet... Restoring a session from a bare cookie requires `POST /auth/refresh`... this ADR explicitly defers it rather than build it as a side effect of route protection."* [ADR 0012](./0012-refresh-token-storage.md) designed the `RefreshToken` table specifically to support this — "rotation deletes the old row and inserts a new one" — and listed `POST /auth/refresh` as a required follow-up to "complete the session model."

That deferred gap stopped being theoretical: a User reported that reloading `/garage`, or navigating to it directly by URL, sends them back to `/login` even though their refresh-token cookie is still present and valid. A first pass ([past session](../past_sessions/2026-06-08-garage-reload-session-redirect.md), commit `2e30de5`) made this *recoverable* — a clean redirect to `/login` instead of a dead-end "couldn't load your garage" error — but the underlying gap remained: every reload or direct navigation to a protected route forces a full re-authentication, even though the browser is still holding a perfectly valid `HttpOnly` refresh-token cookie that the server could use to issue a new access token transparently.

This is also the missing piece for [UC-AUTH-5](../specs/auth/login.md#uc-auth-5--already-authenticated-user-visits-login) ("authenticated User visiting `/login` is redirected away") — [`v1.md`](../milestones/v1.md) explicitly notes that "Token rotation on refresh... also blocks" it, because redirecting requires knowing the User's `account.status`, which only a successful refresh (or a fresh login) can supply from a bare cookie.

## Decision

### `POST /auth/refresh` — a fourth session-issuing endpoint, same shape as the other three

Reads the `refreshToken` `HttpOnly` cookie (no request body — the cookie is the credential), and on success returns the exact same `{ accessToken, user, account }` shape as `register`'s sibling endpoints `verifyEmail` and `login`, plus a rotated refresh-token cookie with identical attributes. This was anticipated verbatim in [login-api.md](../specs/auth/login-api.md)'s Decisions table ("the client applies one `routeForAccountStatus` rule regardless of which... endpoint... produced the session"). `AuthService.refresh` follows the identical "issue a session" code path `verifyEmail`/`login` already share (generate refresh token, compute `expiresAt`, fetch account, sign access token, persist), for the same reason login-api.md gives: two independently written "issue a session" implementations drift.

### Rotation mechanism — delete the old row, insert a new one

Matches ADR 0012's stated design exactly, and is a natural fit for the existing `IRefreshTokenRepository` (`findByTokenHash`, `deleteById`, `create` — no new repository methods needed). An `UPDATE`-in-place was considered and rejected: it would couple the "is this token still valid" check and the "replace it" mutation into one statement, blurring the one-row-per-session invariant ADR 0012 establishes and complicating the not-found / expired guard clauses that `delete` + `create` keep separate and explicit.

### Reuse detection — deferred past V1 (see Consequences)

ADR 0012 names the *ideal* end state: "if a token arrives but its hash is not in the DB... all sessions for that User should be revoked." Implementing that fully requires retaining a record of *which User* a since-rotated hash belonged to — i.e., not deleting rotated rows outright, or keeping a separate "recently rotated" ledger — which is a schema change beyond what `RefreshToken`'s current one-row-per-session shape supports. V1 ships the simpler, still-safe behaviour: any hash that doesn't resolve to a live, unexpired row (whether it's garbage, expired, or already rotated) is treated identically — `401`, falling through to the normal "not signed in" experience. This loses the *mass revocation on detected theft* property but keeps the *attacker cannot extend a stolen session past its `expiresAt`* property, which is the load-bearing guarantee for V1's threat model.

### Where the silent attempt lives — an effect in `AuthProvider`, exactly as ADR 0016 anticipated

> "When `POST /auth/refresh` is eventually built, it slots into the same `AuthProvider`/`apiFetch`/`routeForAccountStatus` seams... likely as an effect in `AuthProvider` that attempts a silent refresh on mount when `session` is `null`."

`AuthProvider` gains an `isRestoring: boolean` alongside `session`. On mount, it calls `apiFetch("/auth/refresh", { method: "POST" })` (the `HttpOnly` cookie travels automatically via `credentials: "include"`); on success it populates `session`, on failure it leaves `session` as `null` — either way `isRestoring` becomes `false` once the attempt settles. Consumers that currently redirect on `session === null` (the garage screen's reload-recovery from the prior session) must wait for `isRestoring` to resolve first, or they will redirect away from a screen the silent refresh was about to repopulate.

### UC-AUTH-5 falls out of the same wiring

Once `session` and `isRestoring` are reliably populated on mount, `/login` can apply the same wait-then-check pattern: if restoration succeeds, redirect immediately via `routeForAccountStatus(session.account.status)` instead of rendering the form.

## Status

accepted

## Consequences

- **`isRestoring` becomes part of the session contract.** Every page that gates behaviour on `session === null` (today: the garage screen; in the future: any protected screen, and now `/login` itself) must distinguish "definitely logged out" (`!isRestoring && !session`) from "haven't checked yet" (`isRestoring`). Skipping this check reintroduces a flash-redirect even when the refresh would have succeeded a moment later.
- **Token reuse detection is explicitly deferred past V1** (see Decision — "Reuse detection"). A stale, garbage, or already-rotated refresh token produces the same `401` as an expired one; there is no mass-revocation-on-theft yet. Tracked as a V2+ item below.
- **Resolves two named V1 gaps in one build**: "Token rotation on refresh" and the UC-AUTH-5 redirect-away-from-`/login`, both tracked in [`v1.md`](../milestones/v1.md) under `## Auth`.
- **`/auth/refresh` completes the session-issuance quartet.** `register`, `verifyEmail`, `login`, and now `refresh` all funnel through the same `{ accessToken, user, account }` shape and `routeForAccountStatus` rule — the "one routing rule regardless of origin" property `login-api.md` anticipated for `refresh` is now real, not aspirational.
- **No new repository methods on `IRefreshTokenRepository`** — `findByTokenHash`, `deleteById`, and `create` (already exposed for `login`/`verifyEmail`) are sufficient for rotation. `IUserRepository` gains one (`findById`), needed to resolve the token record's `userId` back into a full `DomainUser` for re-issuing the access token.

## V2+ items (deferred)

- **Full token-reuse detection and mass revocation** — requires either retaining rotated-token provenance (which User a stale hash belonged to) or a separate "recently rotated" ledger; a schema change beyond this ADR's scope (see Decision — "Reuse detection")
- **`POST /auth/logout`** — named alongside `refresh` in ADR 0012 as completing the session model; not required to fix the restoration gap, tracked separately
