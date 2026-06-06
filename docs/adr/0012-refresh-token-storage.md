# Refresh tokens stored in a dedicated DB table as opaque hashed tokens

## Context

Two alternatives were considered for storing the refresh token issued after login or email verification:

**Option A — field on the User row** (initially proposed).
Simple, mirrors the `verificationToken` pattern. Acceptable for single-session V1.
Rejected because: a User can have multiple concurrent sessions (web browser + mobile app, both in V1/V2 scope). Storing one token per User means any new login silently invalidates all other sessions, with no way to distinguish or revoke individual devices.

**Option B — dedicated `RefreshToken` table** (chosen).
One row per active session. Refresh token rotation deletes the old row and inserts a new one, providing true per-session invalidation. Server-side logout is immediate and surgical.

The comparison with `verificationToken` is instructive: a verification token is a 1:1 property of a User at a point in time (there is only ever one outstanding). A refresh token is a 1:N relationship — a User may have sessions on many devices simultaneously.

## Decision

A `RefreshToken` table with `userId`, `tokenHash`, `expiresAt`.

Refresh tokens are **opaque random tokens** (not JWTs):
- Generated as 32 random bytes (`crypto.randomBytes(32).toString('hex')`) — 256 bits of entropy.
- The raw token is sent to the client once (cookie). Only the SHA-256 hash is persisted. If the DB is compromised, raw tokens remain unknown.
- Validity is entirely controlled by the DB record: rotating means delete + insert, revoking means delete. No clock-skew edge cases.

Access tokens remain JWTs (HS256): stateless, validated on signature + expiry in the `authenticate` middleware with no DB lookup. This keeps the hot path (every authenticated request) fast.

SHA-256 is used to hash refresh tokens rather than bcrypt. Bcrypt is intentionally slow to resist brute-force attacks against low-entropy secrets like passwords. Refresh tokens are 256-bit random values — brute force is computationally infeasible regardless of hash speed, so bcrypt's cost adds latency without security benefit.

## Status

accepted

## Consequences

- Logout is a real server-side operation: delete the `RefreshToken` row.
- Token reuse detection: if a token arrives but its hash is not in the DB (already rotated), the session was either legitimately refreshed elsewhere or the token was stolen — all sessions for that user should be revoked.
- A `POST /auth/refresh` endpoint and a `POST /auth/logout` endpoint are required to complete the session model.
- V2 persistent sessions ("remember me") are a config change on `expiresAt`, not a schema change.
- Multiple device sessions are native: web and mobile each hold a different `RefreshToken` row.
