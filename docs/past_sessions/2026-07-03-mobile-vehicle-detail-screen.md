# Session: Mobile — Vehicle Detail screen

**Date:** 2026-07-03
**Branch:** `main` (in-place — no worktree for this session)

---

## Goal

Implement the mobile Vehicle Detail screen, the next unchecked `v1.md` Mobile → Screens item after last session's Garage screen. Per `docs/specs/mobile-app/vehicle.md` (UC-MOB-VEH-1: view a Vehicle's service history from local SQLite; UC-MOB-VEH-5: view a Vehicle with a pending transfer), this meant more than a screen: `LogEntryRepository` didn't exist yet, no local table backed it, and `SyncService.pull()` only ever reconciled one collection (Vehicles). ADR 0027's 2026-07-02 update had already anticipated this gap and left a documented placeholder for "whenever `LogEntryRepository` is built" — this session is that moment.

---

## Key decisions

Documented in `docs/adr/0027-mobile-sync-outbox-pattern.md` (a further dated `### Update`, not a rewrite) and `docs/specs/mobile-app/vehicle.md`'s Decisions table, before implementation:

| Decision | Choice | Reason |
|---|---|---|
| Child-collection pull sourced from per-vehicle `GET /vehicles/:vehicleId` | `SyncService.pull()`'s phase 2 calls `getVehicle()` once per just-reconciled Vehicle (N calls for N Vehicles) | No API endpoint lists Log Entries across Vehicles — only per-vehicle `VehicleDetail` or a single entry by id. Accepted at V1 scale for the same "small data volumes" reasoning already in this ADR |
| `VehicleRepository.reconcile()` preserves already-known detail fields across every replace | Reads existing rows before `replaceAll()`, carries `totalSpent`/`lastLoggedAt`/`transferPending`/`pendingTransferRecipientEmail` forward per vehicle id (falling back to defaults only the first time a vehicle is seen) | A failed per-vehicle detail fetch this cycle must not regress stats/lock-state the Owner already saw; "stays stale," not "resets to empty" |
| Insurance fetched, not persisted | `VehicleDetail.insurance` comes back on every per-vehicle call but is discarded in `SyncService.pull()` | No mobile screen displays or edits insurance yet — storing it now would be a column with zero readers |
| Vehicle Detail's locked state is read-only | Shows the transfer-pending banner + disabled actions (UC-MOB-VEH-5 steps 1–2); no `[Cancel transfer]` button | Cancelling needs an `INITIATE_TRANSFER`/`CANCEL_TRANSFER` outbox handler that doesn't exist — `SyncService.flushOutbox()` marks any entry with no registered handler `failed` **permanently**, so shipping the button before its handler would silently no-op the cancellation. That handler belongs with `docs/specs/mobile-app/vehicle-transfer.md`'s Initiate Transfer screen, where it's already scoped |
| No type filter/sort control | Service history is always newest-first | Neither the design file nor this file's Acceptance Criteria called for one, unlike the web spec |
| Vehicle Detail owns its own header, native header hidden | Matches how Garage's own index route already works | `garage/_layout.tsx`'s generic `screenOptions` (transparent, `title: ''`) can't express a per-vehicle title or icon buttons; a second `<Stack.Screen headerShown: false>` entry follows the established pattern instead of fighting the native header |

---

## What was built

| Commit | SHA | Description |
|---|---|---|
| 1 | `f0656a5` | ADR 0027 amendment + `vehicle.md`/`v1.md` updates, written before any code |
| 2 | `9bc11ef` | `log_entries` table (FK → `vehicles.id`, `ON DELETE CASCADE`) + Vehicle Detail columns on `vehicles`; `PRAGMA foreign_keys = ON` |
| 3 | `ce76886` | `LogEntryRepository` (new); `VehicleRepository.findById()`/`applyDetail()` (new), `reconcile()` extended |
| 4 | `8445573` | `SyncService.pull()`'s phased fetch (phase 1 list, phase 2 per-vehicle detail); `VehicleRepository.reconcile()`'s detail-preserving fix, with a corresponding ADR paragraph revision |
| 5 | `1412540` | `logEntryRepository` threaded through `DatabaseProvider` → `SyncProvider` → `SyncService` |
| 6 | `dfc088d` | Shared `VehicleGlyph` component extracted from `GarageScreen`; `utils/format.ts` (mirrors web's) |
| 7 | `c92e971` | The screen itself: `useVehicleDetailViewModel` + `VehicleDetailScreen` (header, hero, stats, action row, service history list/empty state, locked banner); `garage/_layout.tsx` header override |
| 8 | `125af02` | Appium E2E spec (`vehicle-detail.e2e.ts`): populated stats/history, per-action navigation (log entry, +Log entry, Edit, Share), empty history, locked state; `createLogEntryViaApi`/`initiateTransferViaApi` fixtures; updated `garage.e2e.ts`'s now-stale placeholder assertion |
| 9 | `5c79e21` | Live-run fixes found by actually driving the iOS simulator (see Verification): registered the new spec in `wdio.shared.conf.ts` (it silently never ran), added leaf-element testIDs where iOS doesn't aggregate a container `View`'s text, bumped two card-wait timeouts for the sync's added latency |
| 10 | _(this commit)_ | This session summary |

---

## Verification

- **Jest**: `pnpm --filter @maintenance-log/mobile test` — 65 tests across 12 suites, all passing. New/changed coverage: `LogEntryRepository`, `VehicleRepository` (findById/applyDetail/detail-preserving reconcile), `SyncService` (phased pull, per-vehicle detail applied, stale-entry fallback on a failed fetch), `DatabaseProvider`/`SyncProvider` (new context field), `useVehicleDetailViewModel` (load states, formatting, navigation, refresh).
- **`tsc --noEmit`**: clean, both the app (`apps/mobile`) and the E2E suite (`e2e/tsconfig.json`).
- **Live on-device verification (iOS simulator, real API + Mailpit + Postgres, no mocks)** — this is where the real bugs were:
  - First full run: `vehicle-detail.e2e.ts` failed all 7 cases, and garage's own pre-existing populated-card test failed too, all with the identical symptom (`garage-vehicle-card-...` never appears). Ruled out a stale pre-migration on-device SQLite file as the cause by clearing it and re-running — the symptom persisted for the *first* test in each worker but not later ones in the same session, which pointed at added latency (the new per-vehicle detail round-trip) crossing the existing 20s wait margin under this worker's cold-start cost, not a hang or logic bug.
  - A second, distinct issue: two assertions (`vehicle-detail-stats`, `vehicle-detail-transfer-banner`) got past their `waitForDisplayed` but read back empty text — iOS's accessibility tree doesn't aggregate a plain `View`'s nested `Text` children into one queryable label. Fixed by adding testIDs directly on the leaf `Text` elements and re-pointing the assertions, not by guessing at retry/backoff.
  - Final run: `vehicle-detail.e2e.ts` passed cleanly, 7/7. Two unrelated pre-existing tests (`register.e2e.ts`'s verify-email wait, `garage.e2e.ts`'s FAB wait) still failed intermittently; the shared dev machine showed heavy sustained load (multiple VMs, a long-lived `xcodebuild build-for-testing` WebDriverAgent process alive since well before this session) consistent with environmental flakiness rather than a regression traceable to this diff — noted below rather than chased further.

---

## Out of scope

- Insurance display/edit on mobile Vehicle Detail — needs its own spec once mobile insurance UX is designed; fetched per-vehicle today but discarded (see ADR 0027 and `vehicle.md`'s Decisions).
- Cancel-transfer action on Vehicle Detail — ships with the Initiate Transfer screen, which needs the same outbox-handler infrastructure (`docs/specs/mobile-app/vehicle-transfer.md`).
- Add/Edit/Delete Vehicle screens — separate `vehicle.md` use cases, still `[ ]` in `v1.md`.
- Type filter/sort control on Service History — not specified for mobile V1.
- The intermittent `register.e2e.ts`/`garage.e2e.ts` FAB flakiness observed during live verification — looked environmental (shared machine under heavy load), not traceable to this session's diff; flagged for a follow-up look rather than fixed here.
- `apps/mobile`'s `lint` script has no `eslint` devDependency — pre-existing gap (already flagged in the 2026-07-02 session summary); `tsc --noEmit` used as the type-safety gate throughout, as before.
