# Session: Wire the garage screen to the backend

**Date:** 2026-06-08
**Branch/worktree:** `worktree-garage-wire-backend`

---

## Goal

The Garage screen (`apps/web/src/app/garage/page.tsx`) was shipped against a stubbed `GARAGE_VEHICLES` array — a deliberate placeholder noted in [`garage-screen.md`](../specs/garage/garage-screen.md)'s "Next steps" while `GET /vehicles` didn't exist yet. That endpoint has since landed and is spec'd as "Implemented" in [`garage-list-api.md`](../specs/garage/garage-list-api.md). This session replaced the stub with a real fetch, including the loading and error states the spec had explicitly deferred, and closed the empty-state E2E gap that was blocked on real data.

## Key decisions

- **Auth via `session.accessToken`, not cookies** — `apiFetch` sends `Authorization: Bearer <token>`, which is what the API's `authenticate` middleware actually checks (`apps/api/src/middleware/auth.ts`); the `refreshToken` cookie only gets a visitor past the Next.js middleware's presence check. Per [ADR 0016](../adr/0016-client-session-and-route-protection.md), the in-memory `AuthProvider` session is the only thing that authorizes API calls — so the effect bails out entirely (`if (!session) return`) until that session exists, matching the documented "no session restoration on reload" gap rather than working around it.
- **`mileage`, not `odometer`** — the stub used `odometer` as the field name; the real API/Prisma/domain contract uses `mileage` (the UI label stays "Odometer," a presentational choice, not a data-shape one). Standardized on `mileage` to match `garage-list-api.md`'s response shape.
- **Explicit `LoadState = "loading" | "loaded" | "error"`** drives the body, derived alongside `isEmpty`/`isPopulated` flags from the fetched list — mirrors the `ApiError`-mapping pattern already used in `(auth)/login/page.tsx` (4xx → silent user-facing message, 5xx/network → `logger.error` + generic message).
- **Avatar left mocked, deliberately** — `Session.user` carries only `{ id, accountId, role }`, no display name. Wiring it for real means adding a `fullName`-style field to the session payload, a backend change beyond "wire the garage to `GET /vehicles`." Documented as a Next step rather than silently left behind.
- **No new CSS** — `LoadingState`/`ErrorState` reuse the existing `.emptyState`/`.emptyHeadline`/`.emptyBody`/`.btnPrimary` classes from `garage.module.css`, keeping the change inside Rule A/B's token-only constraints.

## What was built (1 commit)

`f00f5d8` — **feat(web): wire garage screen to `GET /vehicles` with loading/error states**
- `apps/web/src/app/garage/page.tsx`: removed `GARAGE_VEHICLES`; added `useEffect`-driven fetch through `apiFetch<VehiclesResponse>("/vehicles", { headers: { Authorization: ... } })`, a `retry()` action, and `LoadingState`/`ErrorState` sub-components
- `apps/web/cypress/e2e/garage.cy.ts`: rewritten around a `signIntoGarage` helper that drives the *real* login form (with `POST /auth/login` and `GET /vehicles` intercepted) so the in-memory session genuinely exists before the garage screen mounts — 13 specs across populated/loading/empty/failed-load scenarios, including the previously-blocked empty-state coverage
- `docs/specs/garage/garage-screen.md`: flipped Status to "Implemented," added a "Data loading" acceptance-criteria block, checked off the empty-state/loading/error E2E criteria, rewrote the "Vehicle data source" / "Garage state shown by default" / "Sort order" Decisions rows to describe the real wiring, replaced the "Wire the garage to real Vehicle data" and "Empty-state E2E coverage" Next steps with a single "Wire the avatar to real current-user data" item, and dropped the now-resolved `GET /vehicles` line from Out of scope

## Verification performed

- `pnpm run lint` (apps/web) → clean
- `pnpm run type-check` (apps/web) → clean
- Cypress run against an isolated `next dev -p 3100` instance (kept separate from the user's running dev/API/Cypress processes on 3000/3001): **13/13 passing** — populated garage (8), loading state (1), empty garage (3), failed load (1)

Two test-design issues surfaced and were fixed during this run:
- Browser back-navigation wipes the in-memory session (the exact ADR 0016 gap) — split a combined navigation test into two independent specs that each sign in fresh, instead of relying on `cy.go("back")`
- A counter-based retry intercept was fooled by React 19 Strict Mode's double-invocation of effects on mount (the cancelled first fetch got the 500, the live second fetch got the 200) — replaced it with two static intercepts, registering the recovery response only after asserting the error state had rendered

## Explicitly out of scope (tracked for later)

- Avatar / current-user wiring — needs a `fullName`-style field added to the `Session.user` payload (backend change)
- Real "most recently logged" sort ordering — still blocked on the `LogEntry` model; the grid currently renders `GET /vehicles`'s response order as-is
- Add Vehicle and Vehicle detail screens — separate, already-tracked V1 milestone items with their own specs
