# `POST /auth/logout` and online-required mobile logout

## Context

The mobile logout use case (UC-MOB-AUTH-6, and the Settings entry point UC-MOB-SETTINGS-3) specifies a call to `POST /auth/logout` to invalidate the refresh token server-side. That route does not exist — the auth router only has `register`, `login`, `verify-email`, and `refresh`. So today a "logout" could only clear tokens on the device while the refresh token stayed valid server-side until its 7-day expiry.

The original spec also described logout as *best-effort*: clear tokens and navigate to login even if the server call fails (e.g. offline). That was reconsidered in this session: a logout that leaves a still-valid refresh token alive on the server is not a real logout, so **logout must reach the server to succeed.**

## Decision

**1. Add `POST /auth/logout`** (authenticated). It revokes the caller's refresh token server-side:

```
POST /auth/logout    (Authorization: Bearer <accessToken>, Refresh-Token: <refreshToken>)
204 → refresh token revoked (or already absent — idempotent)
401 → missing/invalid access token
```

The mobile client already injects the `Refresh-Token` header on refresh calls (ADR 0025 / `TokenHttpClient`); logout reuses it. The service hashes the presented refresh token and deletes the matching `RefreshToken` row via `refresh-token.repository` (add `deleteByTokenHash` if absent). A missing row is a no-op success — logout is idempotent and never leaks whether a token existed.

**2. Mobile logout becomes online-required**, replacing the best-effort behavior:

1. Owner confirms the logout alert.
2. App calls `POST /auth/logout` **with tokens still present** (the call needs the refresh token).
3. **On success** (or any server *response*, including a 401 for an already-invalid token): clear `expo-secure-store` + in-memory session and navigate to login.
4. **On network failure** (no response — offline, timeout): keep the session, surface an error such as *"You need to be online to log out."*

This reverses the old step order (which cleared tokens first, then called logout — impossible now, since the call needs the refresh token) and the old "navigate even if the call fails" decision.

## Status

accepted

## Consequences

- Logout now requires connectivity. This is the intended trade-off: the refresh token is genuinely revoked before the local session is discarded, so a logged-out device cannot silently refresh.
- Cold-start clearing (UC-MOB-AUTH-7) is unchanged and still unconditional — that path is about process death, not an explicit logout, and cannot depend on the network.
- A server *response* that is an error status (e.g. 401 because the access token already expired) still completes logout locally — the session is invalid regardless; only a true network failure blocks it.
- api-client gains `logout(client)`; the mobile Settings viewmodel calls it with `tokenHttpClient` (online-only), distinguishing `TimeoutError`/network errors from `ApiError`.

## V2+ items

- "Log out of all devices" (revoke every `RefreshToken` for the user) → V2.
- Biometric unlock as an alternative to full re-auth on cold start → tracked as a V1 mobile-auth TODO (see `docs/specs/mobile-app/auth.md`), was previously V2.
