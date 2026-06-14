# Proactive Access-Token Refresh Spec

**Area:** Auth
**Status:** In progress
**Last updated:** 2026-06-13

---

## Overview

Client-side feature that keeps a signed-in User's in-memory access token fresh *during* an open session, so an authenticated request never fails just because the 15-minute access token expired while the (7-day) refresh-token cookie is still valid.

This is the mid-session counterpart to [UC-AUTH-7](./login.md#uc-auth-7--silent-session-restoration-on-reload-or-direct-navigation) (silent restore on reload). Where UC-AUTH-7 repopulates a session that was *lost* (reload wipes in-memory state), this feature renews a session that is *about to expire* while the page stays open. Both reuse `POST /auth/refresh` ([refresh-api.md](./refresh-api.md)) and the `AuthProvider`/`apiFetch` seams. The full decision record — proactive vs reactive, single-flight, layer placement — is [ADR 0021](../../adr/0021-proactive-access-token-refresh.md).

Use case: [UC-AUTH-8](./login.md#uc-auth-8--proactive-access-token-refresh-before-a-mid-session-request).

---

## API contract change

All three session-issuing endpoints add **`accessTokenExpiresAt`** (ISO 8601 string) to their 200 body, so the client can decide when to refresh without decoding the JWT:

```
{ "accessToken": "...", "accessTokenExpiresAt": "2026-06-13T12:34:56.000Z",
  "user": { "id": "...", "accountId": "...", "role": "owner" },
  "account": { "id": "...", "status": "ONBOARDING" | "ACTIVE" } }
```

- `POST /auth/login` ([login-api.md](./login-api.md)), `GET /auth/verify-email` ([verify-email.md](./verify-email.md)), `POST /auth/refresh` ([refresh-api.md](./refresh-api.md)) — all carry the field.
- `POST /auth/register` issues no session and is **unchanged**.
- `signAccessToken` returns `{ token, expiresAt }`; `expiresAt = issuedAt + JWT_EXPIRES_IN` computed once at the TTL's single source. The refresh-token cookie and its own `expiresAt` are unaffected.

---

## Client behaviour (the `apiClient` coordinator)

Auth is added to `apiFetch` as **interceptors** — `apiFetch` itself stays a generic transport that knows nothing about sessions or `/auth/*` (see [ADR 0021](../../adr/0021-proactive-access-token-refresh.md)). Two interceptors carry the behaviour.

**`authRequestInterceptor`** (async request interceptor) runs before each request:

1. For `/auth/*` paths it is a no-op (so a refresh call never recursively triggers a refresh).
2. Reads the current session from `sessionStore`. No session → pass the request through unchanged.
3. If `accessTokenExpiresAt - now <= 30_000ms` (the **refresh lead** — an in-flight-expiry guard, not a clock-skew defence), it awaits a refresh:
   - **Single-flight**: the first caller starts one `POST /auth/refresh`; concurrent callers in the same window await that same promise. Required — rotation ([ADR 0017](../../adr/0017-refresh-token-rotation.md)) would 401 every refresh after the first, redirecting a just-refreshed User to `/login`.
   - On success, `sessionStore` is replaced with the new `{ accessToken, accessTokenExpiresAt, user, account }`, the cookie rotates, and the token is attached.
   - On failure, it clears the session and passes the request through unauthenticated; that request then 401s and the response interceptor below redirects (one redirect path; the doomed request is the accepted worst case).
4. Otherwise attaches `Authorization: Bearer <token>` and passes the request through.

**`createUnauthorizedInterceptor(onUnauthorized)`** (response interceptor): on a non-`/auth/*` 401 it invokes `onUnauthorized`. This is the retained reactive safety net for any divergence the proactive check misses.

### Layering

- `apiFetch` (`infrastructure/http/apiClient.ts`) is a generic transport: base URL, async interceptor pipeline, send, parse. No auth, no `sessionStore`, no `/auth/*`.
- The interceptor logic lives in `model/services/authInterceptor.ts` (plain TS — the layer that owns API paths + auth headers, [ADR 0020](../../adr/0020-web-mvvm-layered-architecture.md)). It reads `sessionStore` (infrastructure), calls `authService.refreshSession`, and holds the single-flight promise. No React.
- `AuthProvider` is thin wiring: on mount it registers both interceptors (each registration returns an unregister for cleanup) and supplies `onUnauthorized` = `sessionStore.clearSession()` + `logger.info(...)` + `router.push('/login')` — the only React/Next touchpoint.

### Uploads

`apiUpload` is removed. `apiFetch` detects a `FormData` body and lets the browser set the multipart boundary, so `createVehicleWithPhoto` posts through `apiFetch` and is covered by the same refresh coordinator. Multipart stays on the wire.

---

## Acceptance Criteria

- [ ] `signAccessToken` returns `{ token, expiresAt }`; `expiresAt` reflects `JWT_EXPIRES_IN`
- [ ] `POST /auth/login`, `GET /auth/verify-email`, and `POST /auth/refresh` include `accessTokenExpiresAt` (ISO 8601) in their 200 body; `POST /auth/register` does not change
- [ ] The web `Session` type carries `accessTokenExpiresAt`, populated from the response on every session-issuing path
- [ ] A request issued when `accessTokenExpiresAt - now <= 30s` triggers a refresh before the request is sent
- [ ] A request issued with a comfortably-valid token sends immediately, with no refresh call
- [ ] Concurrent requests in the expired window trigger **exactly one** `POST /auth/refresh`; all proceed with the refreshed token (single-flight)
- [ ] On a successful proactive refresh, the original request proceeds with the new access token and the User sees no interruption
- [ ] On a failed proactive refresh, the session is cleared, the event is logged, the User is redirected to `/login`, and the original request does not produce a second redirect
- [ ] `/auth/*` requests never trigger the pre-request refresh check (no recursion)
- [ ] A non-`/auth/*` 401 response still clears the session and redirects to `/login` (retained safety net)
- [ ] Interceptor registration returns an unregister; `AuthProvider` registers both interceptors on mount and cleans them up on unmount (no handler accumulation across remounts)
- [ ] `apiUpload` is removed; `createVehicleWithPhoto` uploads via `apiFetch` with a `FormData` body (multipart preserved)

### E2E tests (Cypress)

- [ ] Mid-session: an authenticated request fired after the access token expires triggers exactly one `POST /auth/refresh`, then succeeds — no redirect
- [ ] Mid-session: when the refresh fails (cookie expired/invalid), the User is redirected to `/login`
- [ ] Creating a vehicle with a photo still succeeds through the unified `apiFetch` upload path

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Proactive vs reactive | Proactive (check expiry before the request) | Reactive's robustness (tolerating client/server disagreement) yields no benefit here: stateless JWTs have no mid-life revocation ([ADR 0002](../../adr/0002-custom-jwt-auth.md)) and clock skew is out of scope. See [ADR 0021](../../adr/0021-proactive-access-token-refresh.md) |
| Learning expiry | API returns `accessTokenExpiresAt`; client never decodes the JWT | The server owns the TTL; stating it explicitly keeps the client from parsing/trusting token internals |
| Refresh lead | 30s | An in-flight-expiry guard so a request doesn't carry a token about to die; not a skew defence |
| Concurrency | Single shared in-flight refresh promise | Rotation ([ADR 0017](../../adr/0017-refresh-token-rotation.md)) would 401 every concurrent refresh after the first |
| Placement | Auth as interceptors; logic in `model/services`, `apiFetch` stays generic | Transport must stay reusable for unauthenticated/3rd-party endpoints; cross-cutting concerns are interceptors (OCP). See [ADR 0021](../../adr/0021-proactive-access-token-refresh.md) |
| `sessionService` → `sessionStore` in infrastructure | Rename + move | It is storage, not domain; the move removes the existing backwards `apiClient → model` import |
| Uploads | Fold `apiUpload` into `apiFetch` (`FormData` detection), keep multipart | Removes a code path that bypassed the interceptors; base64-in-JSON rejected for payload bloat + pipeline churn |
| Interceptor registry | Kept and made async; registration returns an unregister | It is the Open/Closed extension point for cross-cutting HTTP concerns (auth now, retry next); async lets a request interceptor await a refresh; unregister fixes the remount leak |

---

## Out of scope

- **Reactive refresh-and-retry** (transparent 401 recovery) — deferred; see [ADR 0021](../../adr/0021-proactive-access-token-refresh.md) V2+
- **Retry / timeout policy** — built into the client around the `sendRequest` seam; specified separately in [ADR 0022](../../adr/0022-http-client-retry-policy.md)
- **Clock-skew tolerance** — out of scope; worst case is a 401 → `/login`
- **`POST /auth/logout`** — unchanged from [refresh-api.md](./refresh-api.md)'s out-of-scope list
