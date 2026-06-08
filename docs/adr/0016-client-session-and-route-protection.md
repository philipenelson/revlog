# Client-side session management and route protection

## Context

`/login`, `/onboarding`, and `/garage` shipped as UI-only screens with no network calls — by design, per the project's "ship UI first against the approved design, wire network calls later" precedent. The backend session-issuing endpoints now exist (`POST /auth/register`, `GET /auth/verify-email`, and the new `POST /auth/login` — see [login-api.md](../specs/auth/login-api.md)), all returning the same `{ accessToken, user, account }` shape plus an `HttpOnly` refresh-token cookie.

Two things are still undecided and block wiring any of it up:

1. **Where does the access token live on the client, and how do screens reach the API?** [ADR 0002](./0002-custom-jwt-auth.md) already mandates "in memory, never `localStorage`" — but doesn't say *how* that memory is shared across the React tree, or how authenticated requests get the token attached and the refresh cookie sent.
2. **How does `/onboarding` and `/garage` refuse an unauthenticated visitor** — the exact gap the user flagged when reviewing the journey E2E test ("the onboarding screen shouldn't be accessible if the user is not authenticated and the account verified")? [login.md](../specs/auth/login.md) already names the mechanism ("Next.js middleware... redirects unauthenticated users to `/login`"), but middleware runs at the network edge, before any React code mounts — it cannot read the in-memory access token the rest of this ADR proposes.

## Decision

### Session state — a single `AuthProvider` React context

A client component `AuthProvider` (`apps/web/src/lib/auth/AuthProvider.tsx`) wraps the app from the root layout and holds `{ accessToken, user, account } | null` in `useState`. It exposes a `useAuth()` hook with `session`, `setSession(session)`, and `clearSession()`. This is the *only* place the access token is held — purely in-memory, lost on reload, exactly as ADR 0002 requires. No `localStorage`, no cookie mirror, no global mutable variable.

A `routeForAccountStatus(status: AccountStatus)` helper (co-located in `lib/auth/`) is the single source of truth for `'ONBOARDING' → '/onboarding'` / `'ACTIVE' → '/garage'`. `/verify-email`, `/login`, and any future `POST /auth/refresh` client all call it — the routing rule is specified once in [login.md](../specs/auth/login.md) UC-AUTH-1 step 5 and must not be re-derived three different ways.

### Network access — a thin `apiFetch` wrapper, not a generated client or library

`apps/web/src/lib/api.ts` exports `apiFetch(path, init)`: prefixes `process.env.NEXT_PUBLIC_API_URL` (default `http://localhost:3001`), always sets `credentials: 'include'` (so the `HttpOnly` refresh cookie travels on every request without any code having to touch it), JSON-encodes/decodes bodies, and throws a small `ApiError { status, body }` on non-2xx so call sites can apply the spec's two-tier user-error/service-error split (`status < 500` vs. `status >= 500`) without re-parsing responses themselves.

No HTTP library (axios, ky, etc.) and no codegen (openapi-generator, etc.) — the API surface is three endpoints today and the project has no OpenAPI contract to generate from. A generated client would be solving a problem this project doesn't have yet; a thin wrapper is the smallest thing that removes the actual duplication (URL prefixing, cookie credentials, error-shape parsing) across call sites.

### Route protection — middleware checks for the refresh-token cookie's *presence only*

`apps/web/src/middleware.ts` matches `/onboarding/:path*` and `/garage/:path*`. For each request, it checks whether `request.cookies.get('refreshToken')` exists:
- **Absent** → `NextResponse.redirect(new URL('/login', request.url))`
- **Present** → `NextResponse.next()`

This is deliberately a presence check, not a validation. Validating the token would mean either (a) verifying a JWT in the Edge runtime — but the *refresh* token is an opaque random value with no payload to verify, only a hash lookup in Postgres can confirm it ([ADR 0012](./0012-refresh-token-storage.md)) — or (b) calling the API from middleware on every navigation to a protected route, adding a network round-trip (and Edge-to-Postgres-via-Express latency) to page loads that don't need one.

The cookie is `HttpOnly` and `Secure`/`SameSite=Strict` — middleware (server-side) can read it; client-side JS cannot forge or read it. A forged or expired cookie still gets the request *past* middleware, but every subsequent authenticated API call (`apiFetch` with `credentials: 'include'`) hits the real `authenticate` middleware in Express, which does validate — that is where authorization actually lives, per [ADR 0002](./0002-custom-jwt-auth.md). Next.js middleware's job is narrower: keep an unauthenticated browser from ever rendering a protected screen, not authorize API access. This mirrors the existing split between client-side validation (UX, not security) and server-side validation (the actual boundary) that [login.md](../specs/auth/login.md) already documents for form input.

## Status

accepted

## Consequences

- **No session restoration on reload, yet.** If a User refreshes `/onboarding` or `/garage`, `AuthProvider`'s in-memory state is gone — middleware still lets them through (the cookie is present), but `apiFetch` calls requiring an access token would 401. This is a real gap, but it does not block the flow this build wires up: every redirect into a protected route happens via client-side navigation immediately following a session-issuing response (register confirmation → `/verify-email` → token verified → `/onboarding`; login submitted → `/onboarding` or `/garage`) — the in-memory state is always populated *before* the protected route renders. Restoring a session from a bare cookie requires `POST /auth/refresh` ("Token rotation on refresh" — tracked separately in [`v1.md`](../../milestones/v1.md)); this ADR explicitly defers it rather than build it as a side effect of route protection.
- **UC-AUTH-5 ("authenticated User visiting `/login` is redirected away") is not implemented by this middleware.** Doing it correctly means knowing the User's `account.status` to pick a destination — exactly the information `POST /auth/refresh` would supply and bare cookie-presence cannot. Until that endpoint exists, `/login` renders for everyone; an already-authenticated User who navigates back to it simply sees the form again (a UX rough edge, not a security hole — they're already past the gate this ADR builds). Tracked as a follow-up alongside session restoration.
- `apiFetch` becomes the one place that knows how to talk to the API — any future endpoint (vehicles, log entries, etc.) is wired through it, keeping the "thin wrapper, not a library" decision durable rather than a one-off.
- When `POST /auth/refresh` is eventually built, it slots into the same `AuthProvider`/`apiFetch`/`routeForAccountStatus` seams this ADR creates — likely as an effect in `AuthProvider` that attempts a silent refresh on mount when `session` is `null` but a protected route is being rendered. That is a additive change to this architecture, not a replacement of it.
