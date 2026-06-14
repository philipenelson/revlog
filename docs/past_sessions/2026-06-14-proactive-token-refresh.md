# Session: Proactive access-token refresh + HTTP client interceptors & retry

**Date:** 2026-06-14
**Branch:** worktree-proactive-token-refresh → main

---

## Goal

Renew a signed-in user's in-memory access token *before* it expires mid-session, so an authenticated request never fails just because the 15-minute access token lapsed while the 7-day refresh-token cookie is still valid. Closes the long-standing gap in `login.md`'s "Session" criteria ("expired access token is silently refreshed before the user notices"). Along the way, restructure the web HTTP client so auth is a cross-cutting *interceptor* concern rather than baked into `apiFetch`, and add a built-in retry/timeout policy.

---

## Key Decisions

| Decision | Choice | Reason |
|---|---|---|
| Refresh trigger | **Proactive** (check expiry before each request), not reactive | Reactive's robustness yields no end-user benefit here — stateless JWTs have no mid-life revocation ([ADR 0002](../adr/0002-custom-jwt-auth.md)) and clock skew is out of scope. A 401 safety net is retained regardless. ([ADR 0021](../adr/0021-proactive-access-token-refresh.md)) |
| Learning expiry | API returns `accessTokenExpiresAt` (ISO 8601); client never decodes the JWT | The server owns the TTL; `signAccessToken` returns `{ token, expiresAt }` read back from the token's own `exp` |
| Refresh lead | 30s | In-flight-expiry guard so a request doesn't carry an about-to-die token; not a clock-skew defence |
| Concurrency | Single shared in-flight refresh promise | Rotation ([ADR 0017](../adr/0017-refresh-token-rotation.md)) would 401 every concurrent refresh after the first |
| `apiFetch` shape | Generic transport with an **async interceptor pipeline**; no auth/session/`/auth/*` logic inside it | Must stay reusable for unauthenticated/third-party endpoints; cross-cutting concerns are added via interceptors (OCP), never by editing `apiFetch` |
| Auth placement | `authRequestInterceptor` + `createUnauthorizedInterceptor` in `model/services/authInterceptor.ts` (plain TS); `AuthProvider` only registers them + injects the navigation callback | Interceptor logic is framework-free; React/Next stays thin. Registration returns an unregister (fixes the prior remount leak) |
| Unauthorized redirect | Redirect on **any** 401 (incl. `POST /auth/refresh`) | A failed silent restore must reach `/login`; excluding `/auth/*` regressed that (caught by E2E). From `/login` the redirect is a no-op |
| `sessionService` → `sessionStore` | Rename + move to `infrastructure/session/` | It is storage, not domain; removes the backwards `apiClient → model` import |
| Uploads | Fold `apiUpload` into `apiFetch` (`FormData` detection), keep multipart | One code path under the interceptors; base64-in-JSON rejected (payload bloat + multer rewrite) |
| Retry/timeout | Built into the client around the `sendRequest` seam; default-on for **idempotent methods only** (POST excluded), configurable per-call + globally; `AbortController` timeout off by default | Network/timeout resilience without per-call decoration; POST retry would risk duplicate writes ([ADR 0022](../adr/0022-http-client-retry-policy.md)) |

---

## What Was Built

- **ADR 0021** — proactive refresh via async HTTP interceptors; **ADR 0022** — HTTP client retry/timeout policy; **token-refresh.md** spec + **UC-AUTH-8** in `login.md`; v1 milestone entry (`b4fc387`, `610cbf3`)
- **API** — `signAccessToken` returns `{ token, expiresAt }`; `login`/`verifyEmail`/`refresh` return `accessTokenExpiresAt`; service + route specs + tests updated (`385f5c7`)
- **`sessionStore`** — renamed from `sessionService`, moved to `infrastructure/session/` (`aedfff1`)
- **`apiFetch`** — `FormData` support, `apiUpload` removed (`createVehicleWithPhoto` now uses `apiFetch`), `sendRequest` seam extracted; `Session` gains `accessTokenExpiresAt` (`731ee1e`)
- **Interceptor-based auth** — `apiFetch` made generic with an async interceptor pipeline + unregister; `authRequestInterceptor` (proactive refresh + single-flight + token attach) and `createUnauthorizedInterceptor` in `model/services`; `AuthProvider` thinned to wiring (`5714f5d`)
- **Retry/timeout** — configurable, method-aware, around `sendRequest` (`46bac03`)
- **E2E** — `token-refresh.cy.ts` (proactive refresh success, refresh-fail → `/login`, idempotent-GET retry); fixed the any-401 redirect regression the E2E surfaced; `apps/web/CLAUDE.md` documents the HTTP-client/interceptor architecture (`6e1189e`, `610cbf3`)

---

## Verification

- **API**: `pnpm --filter @maintenance-log/api test` → **202/202 passing**; `type-check` clean for changed files (pre-existing `main` errors in `newsletter`/`vehicle.repository`/`log-entry.service.test` remain, unrelated).
- **Web**: `type-check` + `lint` clean for changed files (one pre-existing `VehicleDetailScreen.tsx` `retry` error on `main` remains).
- **Cypress**: full suite **130 passing, 3 failing**. The 3 failures (`garage` "error state…recovers when retried", `onboarding` "user-facing error…recovers when retried", `vehicle-detail` retry) were confirmed **pre-existing on `main`** by running the suite against the main checkout — they are broken UI "retry button" features unrelated to this work (consistent with `main`'s red type-check). The new `token-refresh.cy.ts` is 3/3.

---

## Out of Scope / Deferred

- **Reactive refresh-and-retry** (transparent 401 recovery) — no benefit under V1's stateless-JWT model ([ADR 0021](../adr/0021-proactive-access-token-refresh.md) V2+).
- **Retry jitter** and **idempotency-keyed POST retry** ([ADR 0022](../adr/0022-http-client-retry-policy.md) V2+).
- **Clock-skew tolerance** — worst case is a 401 → `/login`.
- **The 3 pre-existing "retry" E2E failures** and `main`'s red type-check — not touched; they predate this work and belong to a separate, half-implemented error-retry UI feature.
- **Garage not gating its fetch on `isRestoring`** — on a direct reload the first `/vehicles` fires before the session restores (pre-existing race; not worsened here). Worth a follow-up.
