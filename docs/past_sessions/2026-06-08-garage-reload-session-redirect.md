# Session: Redirect to sign-in instead of a dead load-error on garage reload

**Date:** 2026-06-08
**Branch/worktree:** `worktree-garage-wire-backend`

---

## Goal

A live follow-up bug report, found right after fixing the onboarding redirect loop: with the same user (`ph@ph.com`), reloading `/garage` showed an error message ("We couldn't load your garage…") with a "Try again" button that did nothing.

## Root cause

Reloading `/garage` wipes `AuthProvider`'s in-memory session — a documented, accepted gap ([ADR 0016](../adr/0016-client-session-and-route-protection.md), "no session restoration on reload"; the refresh-token cookie still gets the visitor past Next.js middleware, but the access token is gone). The garage screen's `loadState` was initialized via `useState<LoadState>(() => (session ? "loading" : "error"))`, so a missing session immediately rendered the generic load-error state. Its "Try again" button called `retry()`, which bumped a `retryToken` and re-ran the fetch effect — but that effect bails out on `if (!session) return`, so the request never fired and the screen could never recover. The error message ("Our mechanics are on it — try again in a moment") also actively misled the user about what was wrong: nothing was stalled server-side: there was simply no session left to authenticate the request with.

## Key decision

- **Redirect to `/login` on a missing session, rather than build session restoration** — building real recovery (silently repopulating the session from the refresh-token cookie) requires `POST /auth/refresh`, which doesn't exist yet and is tracked separately ("Token rotation on refresh" — [`v1.md`](../milestones/v1.md)). Re-authenticating via `/login` is the *only* working recovery path today, and it's already a clean loop: `/login` renders for everyone (including already-authenticated visitors, per ADR 0016's documented consequences), and `routeForAccountStatus` sends an `ACTIVE` account straight back to `/garage` post-login. Redirecting there directly — instead of showing a misleading error with a non-functional retry — turns a dead end into a one-click recovery.

## What was built (1 commit)

`2e30de5` — **fix(web): redirect to `/login` on the garage screen instead of a dead-end load error**
- `apps/web/src/app/garage/page.tsx`: `loadState` now always initializes to `"loading"`; the fetch effect's `if (!session)` branch calls `router.replace("/login")` instead of silently bailing, with a comment explaining the ADR 0016 connection. Added `useRouter` and `router` to the effect's dependency array
- `apps/web/cypress/e2e/garage.cy.ts`: added a "session lost on reload" describe block — signs into the garage, asserts the populated grid loaded, calls `cy.reload()` (a real reload wipes in-memory React state exactly like the reported bug), and asserts the screen lands on `/login` with the sign-in form visible and no error state rendered
- `docs/specs/garage/garage-screen.md`: added a "No-session redirect" Decisions row, a "Data loading" acceptance-criteria line, and an E2E checklist line; updated the Status line and "Last updated" date

## Verification performed

- `pnpm exec tsc --noEmit` (apps/web) → clean
- `pnpm run lint` (apps/web) → clean
- Cypress run against an isolated `next dev -p 3100` instance (separate from the user's running processes on 3000/3001, dummy `NEXT_PUBLIC_API_URL`): **14/14 passing** in `garage.cy.ts` (13 pre-existing + the new redirect-on-reload spec)

## Explicitly out of scope (tracked for later)

- **Real session restoration on reload** — requires `POST /auth/refresh` (silent token rotation from the refresh-token cookie), tracked separately as "Token rotation on refresh" in [`v1.md`](../milestones/v1.md) and named explicitly in [ADR 0016](../adr/0016-client-session-and-route-protection.md)'s Consequences. This fix makes the *current* gap recoverable (one extra sign-in) rather than building around it
- The same `if (!session)` dead-end pattern likely exists wherever else `apiFetch` is called from a page that assumes a populated session (e.g. a future Vehicle detail or Add Vehicle screen) — not audited here since those screens don't exist yet; worth checking when they're built
