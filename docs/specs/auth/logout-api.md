# Logout API Spec

**Area:** Auth
**Status:** Planned
**Last updated:** 2026-07-05

---

## Overview

Backend implementation for the server-side half of UC-MOB-AUTH-6 (Owner logs out) from
[`docs/specs/mobile-app/auth.md`](../mobile-app/auth.md):

- `POST /auth/logout` — revokes the caller's refresh token server-side.

Until now the auth router had no logout route, so a client "logout" could only clear device tokens while the refresh
token stayed valid until its 7-day expiry. This endpoint makes logout real. See
[ADR 0034](../../adr/0034-auth-logout-and-online-required-mobile-logout.md) for the decision and for why mobile logout
is now **online-required** rather than best-effort.

---

## POST /auth/logout

### Request

```
POST /auth/logout
Authorization: Bearer <accessToken>
Refresh-Token: <refreshToken>
```

The `Refresh-Token` header is the same mechanism mobile already uses on `POST /auth/refresh` (ADR 0025). Web sends its
refresh token via the httpOnly cookie instead; the handler accepts either source (cookie or header), mirroring `refresh`.

### Responses

| Status | Body | When |
|---|---|---|
| 204 | *(empty)* | Refresh token revoked, or no matching token existed (idempotent) |
| 401 | `{ "error": "..." }` | Missing/invalid access token |
| 500 | `{ "error": "Internal server error" }` | Unexpected failure |

Logout is idempotent and does not disclose whether a token existed — a valid access token with an unknown/absent
refresh token still returns 204.

### Side effects

1. `authenticate` verifies the Bearer access token.
2. Read the refresh token from the `Refresh-Token` header (or the `refreshToken` cookie).
3. `authService.logout(refreshToken)` → SHA-256 hash the token, delete the matching `RefreshToken` row via
   `refresh-token.repository.deleteByTokenHash`. A missing row is a no-op.
4. Respond 204. (Web additionally clears the refresh cookie; mobile clears secure-store client-side.)

---

## Acceptance Criteria

- [ ] `POST /auth/logout` with a valid access token and a known refresh token deletes that `RefreshToken` row and returns 204
- [ ] An unknown/absent refresh token still returns 204 (idempotent, no disclosure)
- [ ] Missing/invalid access token returns 401 (service not called)
- [ ] After logout, the revoked refresh token can no longer mint a session via `POST /auth/refresh`
- [ ] `authService.logout` and the route handler each have Vitest unit tests (happy path + guard clauses)

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Refresh-token source | `Refresh-Token` header (mobile) or cookie (web) | Reuses the ADR 0025 mechanism; one handler serves both clients |
| Idempotency | Missing row → 204 | Logout should never fail because the token was already gone; avoids leaking token existence |
| Mobile behavior | Online-required (see ADR 0034) | A logout that leaves a valid refresh token alive server-side is not a real logout |

---

## Out of scope

- "Log out of all devices" (revoke every `RefreshToken` for the user) → V2
- Access-token denylist / immediate access-token invalidation → V2 (access tokens remain valid until their 15-min expiry; only the refresh token is revoked)
