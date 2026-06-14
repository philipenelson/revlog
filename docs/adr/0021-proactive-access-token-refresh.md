# Proactive access-token refresh via async HTTP interceptors

## Context

[ADR 0016](./0016-client-session-and-route-protection.md) established `AuthProvider` as an in-memory session store plus a thin `apiFetch` wrapper. [ADR 0017](./0017-refresh-token-rotation.md) added `POST /auth/refresh` and a silent session *restore on mount*. Both deferred renewing an access token that expires *during* an open session — and [login.md](../specs/auth/login.md)'s "Session" acceptance criteria still tracks the remaining gap verbatim: *"Expired access token is silently refreshed using the refresh token before the user notices… proactively or reactively renewing an access token that expires mid-session… isn't wired up yet — remains a gap."*

That gap bites in practice. The access token is a stateless JWT with a 15-minute TTL ([ADR 0002](./0002-custom-jwt-auth.md), `apps/api/src/lib/tokens.ts`). A User who keeps a screen open — or backgrounds the tab — past 15 minutes will 401 on their next API call even though the `HttpOnly` refresh-token cookie is still valid for 7 days. Today that 401 simply bounces them to `/login` (the response interceptor added in commit `7ad0727`); the cookie that could have transparently re-issued an access token goes unused mid-session.

This ADR records how that mid-session renewal is wired, and the trade-offs taken to get there. A sibling decision — the HTTP client's retry/timeout policy, which shares the same `sendRequest` seam — is recorded separately in [ADR 0022](./0022-http-client-retry-policy.md).

## Decision

### Proactive, not reactive

The client checks the access token's expiry *before* each request and refreshes when it is at or near expiry — rather than letting the request 401 and retrying it transparently (reactive).

Reactive is the more common pattern and is generally more robust: it needs no client-side knowledge of expiry and tolerates any disagreement between what the client believes and what the server enforces. We chose proactive anyway because, *in this architecture*, that robustness buys no meaningful end-user benefit:

- Access tokens are **stateless JWTs** ([ADR 0002](./0002-custom-jwt-auth.md)) — once signed they are valid until `exp` with no server-side revocation path. "Token rejected before its `exp`" cannot occur here.
- **Clock skew** (the other case where client-belief and server-truth diverge) is explicitly out of scope for V1.

The only residual divergence is a token expiring *exactly* in flight; the 30s refresh lead (below) shrinks that window to near zero, and its worst case is a single 401 → `/login`, which we accept. A reactive 401 safety net is retained regardless (the `onUnauthorized` response interceptor, below), so even that rare case is handled — just by redirect, not by transparent retry.

### The client learns expiry from the API, not by decoding the JWT

All session-issuing endpoints (`login`, `verifyEmail`, `refresh`) add **`accessTokenExpiresAt`** (ISO 8601) to their JSON response, alongside `accessToken`/`user`/`account`. The client stores it on `Session` and compares against `Date.now()`. We chose this over decoding the JWT client-side so the client never parses or trusts token internals — the server, which owns the TTL (`JWT_EXPIRES_IN`), states the expiry explicitly. `signAccessToken` returns `{ token, expiresAt }` so the value is computed once, at the single source of the TTL, rather than re-derived by parsing a string.

### A 30s refresh lead

A request refreshes when `accessTokenExpiresAt - now <= 30s`, so a request never goes out carrying a token about to die mid-flight. This is **not** a clock-skew defence (skew is out of scope) — purely an in-flight-expiry guard.

### Single-flight refresh — required, not optional

Refresh-token rotation ([ADR 0017](./0017-refresh-token-rotation.md)) deletes the old row and issues a new one; any later use of a rotated or unknown hash is an indistinguishable 401 (ADR 0017, "Reuse detection"). So if *N* requests fire while the token is expired and each independently calls `/auth/refresh`, the first rotates the cookie and the rest 401 — bouncing a just-refreshed User to `/login`. The refresh interceptor therefore shares **one in-flight refresh promise** across all concurrent callers; the rest await it and reuse its result.

### `apiFetch` stays a generic transport; auth is layered on as async interceptors

`apiFetch` is a **generic HTTP client** — it prefixes the base URL, runs an interceptor pipeline, sends the request, and parses the response. It knows nothing about sessions, tokens, or `/auth/*` paths. It happens to only call our own API today, but must stay reusable for unauthenticated and third-party endpoints, so no auth conditional belongs inside it.

All auth behaviour is expressed as **interceptors** registered on the existing `register{Request,Response}Interceptor` registry (commit `7ad0727`), which is kept precisely because it is the Open/Closed extension point for cross-cutting concerns. The interceptor signatures become **async** so a request interceptor can `await` a refresh:

- **`authRequestInterceptor`** (request, async): for non-`/auth/*` paths, if the in-memory session is within the 30s lead of expiry it awaits the single-flight refresh, then attaches `Authorization: Bearer <token>`. On refresh failure it clears the session and proceeds — the request then 401s and the response interceptor handles the redirect (a single redirect path; the doomed request is the accepted worst case).
- **`createUnauthorizedInterceptor(onUnauthorized)`** (response): on **any** 401 it invokes the injected `onUnauthorized` callback — covering a failed silent restore (`POST /auth/refresh` on mount), a failed proactive refresh, and a token the server rejected mid-session. This is also the reactive safety net for any divergence the proactive check misses; from `/login` the redirect is a harmless no-op.

`/auth/*` is excluded from the *request* interceptor (it is auth-aware by nature) — never in `apiFetch` — which prevents the refresh call from recursively triggering a refresh.

### Where the auth interceptors live — `model/services`; React stays thin

The interceptor *logic* lives in `model/services` (`authInterceptor.ts`), the layer [ADR 0020](./0020-web-mvvm-layered-architecture.md) designates as "the only place that knows API paths and auth headers." It is plain TypeScript: it reads `sessionStore` (infrastructure), calls `authService.refreshSession` (same layer), and holds the single-flight promise. It has **no React/Next dependency**.

`AuthProvider` shrinks to thin wiring: on mount it registers the two interceptors and supplies the `onUnauthorized` callback (`clearSession` + `logger` + `router.push('/login')`) — the only place the Next router is touched. Registration returns an **unregister** function so `AuthProvider` cleans up on unmount, replacing the previous push-with-no-cleanup that leaked a handler on every remount.

### `sessionService` → `sessionStore`, moved to infrastructure

The in-memory session holder has **no domain logic** — it is storage, mirroring `infrastructure/media`. It is renamed `sessionStore` and moved to `infrastructure/session/`, so it can be read by both the transport and the auth interceptor without inverting a dependency. The `Session` *type* stays in `model/types.ts`; only the mutable store moves.

### `apiUpload` folded into `apiFetch`

`apiFetch` detects a `FormData` body and omits the `application/json` `Content-Type` so the browser sets the multipart boundary. `apiUpload` is removed and its sole caller (`createVehicleWithPhoto`) routes through `apiFetch` — so uploads run the same interceptor pipeline. Multipart stays on the wire; base64-in-JSON was rejected (≈33% payload inflation, full-file buffering on both ends, and a needless rewrite of the multer pipeline).

## Status

accepted

## Consequences

- Closes the mid-session half of the "expired access token is silently refreshed before the user notices" criterion that [login.md](../specs/auth/login.md) has tracked since ADR 0017 ([UC-AUTH-8](../specs/auth/login.md#uc-auth-8--proactive-access-token-refresh-before-a-mid-session-request)).
- **`accessTokenExpiresAt` joins the session-issuing response contract** for `login`/`verifyEmail`/`refresh` (`register` issues no session and is unchanged). The affected API specs and the web `Session` type carry the new field.
- **`apiFetch` is now auth-free and generic** — token attachment moved out of it into `authRequestInterceptor`. New cross-cutting behaviour is added by registering interceptors, never by editing `apiFetch` (OCP).
- **Interceptors are async** and registration returns an unregister function (fixing the remount handler leak).
- `AuthProvider` (application) keeps only the thin registration + the navigation callback; the auth logic is plain TS in `model/services`, framework-free.
- A burst of expired-token requests yields **exactly one** `/auth/refresh` — asserted in Cypress.

## V2+ items

- **Reactive refresh-and-retry** (transparent 401 recovery) — only worth adding if access tokens gain a server-side revocation path or clock skew becomes a concern; neither holds in V1.
- **Token reuse detection / mass revocation** — unchanged from [ADR 0017](./0017-refresh-token-rotation.md)'s deferral.
