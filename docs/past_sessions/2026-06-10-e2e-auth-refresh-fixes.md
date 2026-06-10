# Session: E2E Auth-Refresh Fixes

**Date:** 2026-06-10
**Branch:** worktree-prancy-doodling-donut → main

---

## Goal

Fix the 4 Cypress spec files left broken at the end of the journey-smoke-test
session (`add-vehicle.cy.ts`, `edit-vehicle.cy.ts`, `log-entry.cy.ts`,
`vehicle-detail.cy.ts` — 40/130 tests failing, 19 pending) without skipping
any tests, adding a DB seed script only if it turned out to be necessary.

---

## Key Decisions

| Decision | Choice | Reason |
|---|---|---|
| Root cause | Every failure traced back to the same issue identified in the prior session: `cy.visit()` always starts with a null in-memory session (ADR 0016), and without a stubbed `POST /auth/refresh`, `AuthProvider`'s silent restore fails silently | Depending on the page, this manifested as a redirect to `/login` (vehicle-detail), a permanently-stuck loading skeleton (edit-vehicle), or a no-op submit handler whose `if (!session) return` guard meant the expected API call never fired (add-vehicle, log-entry) |
| Fix pattern | Per-spec `stub<Spec>AuthRefresh()` helper — `cy.intercept("POST", "**/auth/refresh", { statusCode: 200, body: { accessToken, user, account: { status: "ACTIVE" } } }).as("refresh")` — registered after any login-form flow (so it doesn't trigger `LoginPage`'s redirect-if-authenticated effect) but before the protected-route `cy.visit()`, followed by `cy.wait("@refresh")` | Mirrors `journey.cy.ts`'s `jStubAuthRefresh` pattern from the prior session, validated across all 4 specs |
| Helper naming | `stubAuthRefresh` (add-vehicle), `stubEditVehicleAuthRefresh` (edit-vehicle), `stubVehicleDetailAuthRefresh` (vehicle-detail), `stubLogEntryAuthRefresh` (log-entry) | Cypress spec files have no imports/exports, so they share TS global scope — unique names avoid new `Cannot redeclare block-scoped variable` collisions (pre-existing `VEHICLE_ID`/`ACCESS_TOKEN` collisions across edit-vehicle/vehicle-detail/log-entry were left as-is; they don't block `cypress run`, which is transpile-only) |
| DB seed script | Not added | All 40 failures were fixable via `cy.intercept` stubs alone — no test required real backend state |

---

## What Was Built

### Tests (`apps/web/cypress/e2e/`)
- `add-vehicle.cy.ts` (1e0f368) — added `stubAuthRefresh()`; fixed a pre-existing `ADD_VEHICLE_DRAFT`/`VEHICLE_DRAFT` naming bug (`ReferenceError`); reordered `beforeEach` intercepts to fix a `GET /vehicles` race. **14/14 passing** (was 6/6/2)
- `edit-vehicle.cy.ts` (f4ee706) — added `stubEditVehicleAuthRefresh()` before all 9 protected-route visits. **12/12 passing** (was 0/12/0)
- `vehicle-detail.cy.ts` (755d72f) — added `stubVehicleDetailAuthRefresh()`, applied via a single edit to the shared `signIntoVehicleDetail` helper (covers all 29 tests); `scrollIntoView()` before asserting the insurance dialog's Save button is visible, since in edit mode with no existing insurance the dialog content exceeds the default viewport height and the footer sits below the internal scroll fold. **29/29 passing** (was 0/18/11)
- `log-entry.cy.ts` (cbabae0) — added `stubLogEntryAuthRefresh()` to both the create-screen and edit-screen `beforeEach` hooks. **17/17 passing** (was 7/4/6)

---

## Verification

- `npx cypress run` (full suite, all 9 specs): **130/130 passing, 0 failing, 0 skipped**
  - `add-vehicle.cy.ts` — 14/14 ✔
  - `auth.cy.ts` — 5/5 ✔
  - `edit-vehicle.cy.ts` — 12/12 ✔
  - `garage.cy.ts` — 17/17 ✔
  - `journey.cy.ts` — 19/19 ✔
  - `log-entry.cy.ts` — 17/17 ✔
  - `onboarding.cy.ts` — 14/14 ✔
  - `vehicle-detail.cy.ts` — 29/29 ✔
  - `verify-email.cy.ts` — 3/3 ✔
- Confirmed via grep that no spec file uses `.skip()`/`xit()`/`xdescribe()` — the 19 "pending" tests in the original screenshot were Mocha aborting suites on `beforeEach` hook failures, not literal skips
- `pnpm exec eslint` (via pre-commit hook): passed on all four commits

---

## Out of Scope

- The pre-existing `Cannot redeclare block-scoped variable 'VEHICLE_ID'`/`'ACCESS_TOKEN'` TypeScript diagnostics across `edit-vehicle.cy.ts`, `vehicle-detail.cy.ts`, and `log-entry.cy.ts` (each declares its own top-level constants of the same name with different values, in shared TS global scope). These don't block `cypress run` (transpile-only, no typecheck) and were out of scope for this session — a follow-up could prefix each spec's constants the way `journey.cy.ts` does with `J_`.
- The insurance-dialog overflow on short viewports (the cause of the `scrollIntoView()` fix above) is a real UX consideration: on a ~660px-tall viewport, the edit-mode dialog's Save/Cancel footer requires scrolling within the dialog to reach. A sticky dialog footer would improve this for real users, but is a CSS/UX change outside the scope of "fix broken e2e tests."
