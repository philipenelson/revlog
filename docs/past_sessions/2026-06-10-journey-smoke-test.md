# Session: Journey Smoke Test

**Date:** 2026-06-10
**Branch:** worktree-journey-smoke-test → main

---

## Goal

Rewrite `apps/web/cypress/e2e/journey.cy.ts` so it covers the happy path through every major app flow — login, registration, email verification, unauthenticated redirects, session restore, onboarding (add first vehicle / skip), garage, add vehicle, vehicle detail, insurance, and log entry create/edit/delete — as a single end-to-end smoke test for the whole app. Per-feature spec files continue to own edge cases and error handling (per `docs/adr/0006-cypress-e2e-testing.md`).

---

## Key Decisions

| Decision | Choice | Reason |
|---|---|---|
| Naming collisions across spec files | Prefix journey-only helpers/constants with `J_` (`jSignIn`, `jSignIntoGarage`, `jSignIntoVehicleDetail`, `J_VEHICLE_ID`, `J_ACCESS_TOKEN`, ...) | `.ts` files without `export {}` are global scripts in this `tsconfig`; identically-named top-level `const`/`function` across spec files collide (TS2393/TS2451) |
| Session restore on full-page reload | New `jStubAuthRefresh()` helper intercepts `POST **/auth/refresh` with a 200 + session body before any `cy.visit()` to a protected route | `cy.visit()` always triggers a full reload, wiping the in-memory access token (ADR 0016/0017). Without the stub, `AuthProvider`'s silent refresh fails, the page redirects to `/login`, and the expected API call never fires |
| Onboarding step selectors | Use the actual `data-testid`s and copy from `onboarding/page.tsx` (`add-first-vehicle-btn`, `continue-btn`, `"Triumph Street Triple RS is in your garage"`, `go-to-garage-btn`, `skip-onboarding-btn`) | The previous spec referenced stale button text/copy that no longer matches the page |

---

## What Was Built

### Tests (`apps/web/`)
- `cypress/e2e/journey.cy.ts` — full rewrite covering all major flows end-to-end via `cy.intercept` stubs (5806488)
- `cypress/e2e/journey.cy.ts` — fixed onboarding selectors/copy and added `jStubAuthRefresh()` calls before every protected-route `cy.visit()` (baaa501)

### Bug fix (`apps/web/`)
- `src/app/layout.tsx`, `src/lib/media/MediaStoreProvider.tsx` — moved `new OpfsMediaStore()` instantiation from the root Server Component into `MediaStoreProvider` via `useState(() => new OpfsMediaStore())` (9ba226b)

This was a pre-existing, app-wide bug (introduced in `aadbad6`): passing a class instance as a prop from a Server Component to a Client Component violates React's RSC serialization rules ("Only plain objects ... Classes or null prototypes are not supported"), so **every page on `main` returned HTTP 500**, including `/login`. This was discovered while trying to run `journey.cy.ts` at all — no Cypress spec could pass against `main` in this state. Fixing it was a prerequisite for verifying this session's actual deliverable.

---

## Verification

- `npx tsc --noEmit`: zero new TypeScript errors vs. `main`'s baseline (only the 6 pre-existing TS2451 redeclare errors in edit-vehicle/log-entry/vehicle-detail specs remain, unchanged)
- `npx cypress run --spec cypress/e2e/journey.cy.ts`: **19/19 passing**
- `npx cypress run` (full suite, all 9 specs) after the `layout.tsx`/`MediaStoreProvider` fix:
  - `auth.cy.ts` — 5/5 ✔
  - `garage.cy.ts` — 17/17 ✔
  - `journey.cy.ts` — 19/19 ✔
  - `onboarding.cy.ts` — 14/14 ✔
  - `verify-email.cy.ts` — 3/3 ✔
  - `add-vehicle.cy.ts`, `edit-vehicle.cy.ts`, `log-entry.cy.ts`, `vehicle-detail.cy.ts` — 37 failures total, see Out of Scope
- `pnpm exec eslint` (via pre-commit hook): passed on all three commits

---

## Out of Scope

- **37 pre-existing failures across `add-vehicle.cy.ts`, `edit-vehicle.cy.ts`, `log-entry.cy.ts`, and `vehicle-detail.cy.ts`.** All share the same root cause this session fixed in `journey.cy.ts`: these specs `cy.visit()` protected routes after login without stubbing `POST /auth/refresh`, so the in-memory access token loss on reload sends them to `/login` instead of the target page, and the expected `cy.wait()` calls time out with "no request ever occurred." This is independent of the `layout.tsx` fix above (it was already broken before, just masked by the app-wide 500). Fixing these four specs with the same `jStubAuthRefresh`-style pattern is a follow-up task.
- Edge cases and error handling for individual flows — owned by the per-feature spec files (`add-vehicle.cy.ts`, `edit-vehicle.cy.ts`, etc.), not `journey.cy.ts`.
