# Proactive in-memory access-token refresh

## Context

[ADR 0016](./0016-client-session-and-route-protection.md) established `AuthProvider` as an in-memory session store plus a thin `apiFetch` wrapper. [ADR 0017](./0017-refresh-token-rotation.md) added `POST /auth/refresh` and a silent session *restore on mount*. Both deferred renewing an access token that expires *during* an open session — and [login.md](../specs/auth/login.md)'s "Session" acceptance criteria still tracks the remaining gap verbatim: *"Expired access token is silently refreshed using the refresh token before the user notices… proactively or reactively renewing an access token that expires mid-session… isn't wired up yet — remains a gap."*

That gap bites in practice. The access token is a stateless JWT with a 15-minute TTL ([ADR 0002](./0002-custom-jwt-auth.md), `apps/api/src/lib/tokens.ts`). A User who keeps a screen open — or backgrounds the tab — past 15 minutes will 401 on their next API call even though the `HttpOnly` refresh-token cookie is still valid for 7 days. Today that 401 simply bounces them to `/login` (the response interceptor added in commit `7ad0727`); the cookie that could have transparently re-issued an access token goes unused mid-session.

This ADR records how that mid-session renewal is wired, and the trade-offs taken to get there.

## Decision

### Proactive, not reactive

The client checks the access token's expiry *before* each request and refreshes when it is at or near expiry — rather than letting the request 401 and retrying it transparently (reactive).

Reactive is the more common pattern and is generally more robust: it needs no client-side knowledge of expiry and tolerates any disagreement between what the client believes and what the server enforces. We chose proactive anyway because, *in this architecture*, that robustness buys no meaningful end-user benefit:

- Access tokens are **stateless JWTs** ([ADR 0002](./0002-custom-jwt-auth.md)) — once signed they are valid until `exp` with no server-side revocation path. "Token rejected before its `exp`" cannot occur here.
- **Clock skew** (the other case where client-belief and server-truth diverge) is explicitly out of scope for V1.

The only residual divergence is a token expiring *exactly* in flight; the 30s refresh lead (below) shrinks that window to near zero, and its worst case is a single 401 → `/login`, which we accept. A reactive 401 safety net is retained regardless (see below), so even that rare case is handled — just by redirect, not by transparent retry.

### The client learns expiry from the API, not by decoding the JWT

All session-issuing endpoints (`login`, `verifyEmail`, `refresh`) add **`accessTokenExpiresAt`** (ISO 8601) to their JSON response, alongside `accessToken`/`user`/`account`. The client stores it on `Session` and compares against `Date.now()`. We chose this over decoding the JWT client-side so the client never parses or trusts token internals — the server, which owns the TTL (`JWT_EXPIRES_IN`), states the expiry explicitly. `signAccessToken` returns `{ token, expiresAt }` so the value is computed once, at the single source of the TTL, rather than re-derived by parsing a string.

### A 30s refresh lead

A request refreshes when `accessTokenExpiresAt - now <= 30s`, so a request never goes out carrying a token about to die mid-flight. This is **not** a clock-skew defence (skew is out of scope) — purely an in-flight-expiry guard.

### Single-flight refresh — required, not optional

Refresh-token rotation ([ADR 0017](./0017-refresh-token-rotation.md)) deletes the old row and issues a new one; any later use of a rotated or unknown hash is an indistinguishable 401 (ADR 0017, "Reuse detection"). So if *N* requests fire while the token is expired and each independently calls `/auth/refresh`, the first rotates the cookie and the rest 401 — bouncing a just-refreshed User to `/login`. The coordinator therefore shares **one in-flight refresh promise** across all concurrent callers; the rest await it and reuse its result.

### The coordinator lives in `apiClient` (infrastructure); only cross-layer callbacks are injected

The expiry check, single-flight, header attachment, and 401 safety net live in `apiClient` — the transport layer every request already funnels through. The two things that genuinely cross a layer boundary are injected from `AuthProvider` via `registerSessionHooks({ refresh, onRefreshFailed })`:

- **`refresh: () => Promise<Session>`** — sourced from `authService.refreshSession`. `model/services` is the only place that knows API paths and payload shapes ([ADR 0020](./0020-web-mvvm-layered-architecture.md)); `infrastructure` cannot import `model`, so the callable is handed *down*.
- **`onRefreshFailed: () => void`** — clears the session and redirects via the Next router. The router only exists inside the provider component, and "where to send a logged-out User" is application policy, not transport.

Registration is **idempotent** (overwrites, returns an unregister) so `AuthProvider` cleans up on unmount — replacing the unbounded push-array interceptor registry from commit `7ad0727`, which accumulated a handler on every remount.

### `sessionService` → `sessionStore`, moved to infrastructure

The in-memory session holder has **no domain logic** — it is storage, mirroring `infrastructure/media`. It is renamed `sessionStore` and moved to `infrastructure/session/`, so `apiClient` (infrastructure) reads and writes it directly — same layer, no backwards dependency. (It previously lived in `model/services` and was imported by `apiClient`, inverting ADR 0020's dependency direction; the "Service" suffix is what misfiled it.) The `Session` *type* stays in `model/types.ts`; only the mutable store moves.

### `apiUpload` folded into `apiFetch`

`apiFetch` detects a `FormData` body and omits the `application/json` `Content-Type` so the browser sets the multipart boundary. `apiUpload` is removed and its sole caller (`createVehicleWithPhoto`) routes through `apiFetch` — bringing uploads under the same refresh coordinator. Multipart stays on the wire; base64-in-JSON was rejected (≈33% payload inflation, full-file buffering on both ends, and a needless rewrite of the multer pipeline).

### The generic interceptor registry is removed

`registerRequestInterceptor` / `registerResponseInterceptor` (commit `7ad0727`) had a single consumer — the 401 redirect — now expressed directly in `apiFetch` via `onRefreshFailed`. The typed `SessionHooks` replace the untyped arrays.

### A retry/backoff seam, left explicit but unimplemented

The single `fetch` call is isolated in `sendRequest`. A future `withRetry(sendRequest, …)` with exponential backoff for timeouts and network failures wraps *that* function — below the auth layer — so a network retry never re-runs the token check or triggers a refresh. The backoff policy itself is out of scope here.

## Status

accepted

## Consequences

- Closes the mid-session half of the "expired access token is silently refreshed before the user notices" criterion that [login.md](../specs/auth/login.md) has tracked since ADR 0017 ([UC-AUTH-8](../specs/auth/login.md#uc-auth-8--proactive-access-token-refresh-before-a-mid-session-request)).
- **`accessTokenExpiresAt` joins the session-issuing response contract** for `login`/`verifyEmail`/`refresh` (`register` issues no session and is unchanged). The affected API specs ([login-api.md](../specs/auth/login-api.md), [refresh-api.md](../specs/auth/refresh-api.md), [verify-email.md](../specs/auth/verify-email.md)) and the web `Session` type carry the new field.
- `AuthProvider` (application) imports the infrastructure session store and the `apiClient` registration hook directly — consistent with its existing `logger`/`apiClient` imports. The strict `app → model → infrastructure` chain in ADR 0020 (rule 4) is relaxed for the provider whose job is precisely to wire infrastructure into the React tree.
- The 401 response path still redirects (and now also clears the session); it is no longer the primary renewal mechanism but remains the safety net for any divergence the proactive check misses.
- A burst of expired-token requests yields **exactly one** `/auth/refresh` — asserted in Cypress.

## V2+ items

- **Reactive refresh-and-retry** (transparent 401 recovery) — only worth adding if access tokens gain a server-side revocation path or clock skew becomes a concern; neither holds in V1.
- **Exponential-backoff retry** for timeouts / network failures — the `sendRequest` seam is in place; the policy is deferred.
