# Session: Mobile — Garage screen + offline-first foundation

**Date:** 2026-07-02
**Branch:** `main` (in-place — no worktree for this session)

---

## Goal

Implement the mobile Garage screen. Turned out to mean more than "add a screen": `docs/milestones/v1.md`'s Mobile → Infrastructure section confirmed ADRs 0026 (local database) and 0027 (outbox sync) were accepted but entirely unimplemented — no `expo-sqlite`/`drizzle-orm`/`@react-native-community/netinfo` dependencies, no `infrastructure/database/`, no `domain/repositories/`, no `infrastructure/sync/`. `GarageScreen.tsx` was a `<ScreenPlaceholder>`. This session built the offline-first foundation those ADRs describe, then the screen on top of it, per `docs/specs/mobile-app/garage.md` (already written, status "Not started").

---

## Key decisions

Two product decisions were locked in before implementation:

| Decision | Choice | Reason |
|---|---|---|
| Card meta line drops the design's "Last entry &lt;date&gt;" text | Meta reads `"${year} ${make} ${model}"`; the existing entries-count badge conveys activity instead | `GET /vehicles` (`VehicleSummary`) has no last-logged-at field — only the per-vehicle detail endpoint does |
| Build the full Outbox pipeline now, unexercised | Table, `OutboxRepository`, `SyncService.flushOutbox()` all built and unit-tested against an injected, currently-empty handler registry | Nothing enqueues outbox entries yet (no write screen exists), but the dispatch/ordering/retry mechanism is real and tested so Add Vehicle only needs to register a handler, not design the mechanism |

The persistence-port design went through several rounds of review before implementation started (each one a real correction, not cosmetic):

| Decision | Choice | Reason |
|---|---|---|
| `Store<T>` port, not `LocalDatabase` | `getAll`/`save`/`remove`/`replaceAll`, generic per entity — no raw SQL (`execute(sql)`/`query(sql)`) | ADR 0026's original port name and shape presupposed a SQL/database backend and a "local" deployment fact, neither of which the port itself needs to promise — only the adapter (`SQLiteStore`) does |
| No module-level singleton for the database connection | `DatabaseProvider` (mirrors `AuthProvider`) owns the async open-once lifecycle via React state/context, exposing only repositories, never the raw `Store`/connection | A singleton getter means tests either hit real `expo-sqlite` or fight module-level state; explicit DI via context is mockable without stubbing globals |
| No generic cross-collection `transaction()` on the port | `replaceAll()` (atomic full-collection replace) covers the one real atomicity need (`VehicleRepository.reconcile()`); `SyncService.flushOutbox()` uses a `RetryableOutboxError` marker instead of inspecting `ApiError`/HTTP status itself | A generic `transaction(fn)` assumes every adapter can do multi-statement atomicity (untrue in general) and doesn't even solve cross-*Store* atomicity (each `Store<T>` is scoped to one collection). HTTP-status classification belongs at the handler boundary, where HTTP actually happens, not in a should-be-transport-agnostic dispatch loop |
| `Store<T>` instantiated once per entity, not a shared instance keyed by a `collection: string` argument | `createSQLiteStore<VehicleSummary>(db, vehiclesTable)`, `createSQLiteStore<OutboxEntry>(db, outboxTable)` | A shared instance with a string+generic-type pair per call has no compiler-enforced correspondence between them |
| `packages/api-client` stays as-is; no `RemoteVehicleRepository` | `SyncService.pull()` keeps calling `listVehicles(client)` directly | `packages/api-client` is shared by both apps and shouldn't be forced into one app's "repository" vocabulary; a wrapper would have exactly one caller and no behavior — the trivial-wrapper anti-pattern, just relocated |

A real correctness gap surfaced during design review — not yet triggered by anything in this pass (Garage only ever reconciles one collection with no children, and no write flow exists), but documented as **dated "Update" sections on ADR 0026 and ADR 0027** (original content preserved, not rewritten) so `LogEntryRepository` and Add Vehicle have a settled answer:

- **Pull-side ordering** (a future Log Entry reconciled before its parent Vehicle exists locally): resolved by reconciling parent collections to completion before dependent children, scoped from the *freshly reconciled* parent state — plus `PRAGMA foreign_keys = ON` + `ON DELETE CASCADE` for free orphan cleanup, mirroring the API's own cascading deletes. No cross-collection transaction needed.
- **Push-side ordering** (a future Log Entry outbox entry referencing a Vehicle outbox entry not yet confirmed by the server): resolved by client-generated ids for offline-created entities (not server-assigned, which `POST /vehicles` doesn't accept yet — a prerequisite this surfaces for Add Vehicle) combined with the outbox flush already processing in `created_at` order and halting (not skipping) on retryable failure.
- Soft-delete + timestamp-watermark incremental sync (already ADR 0027's "Incremental pull" V2+ item) was confirmed as the right upgrade path once data volume justifies it — not now, at this app's current scale.

---

## What was built

| Commit | SHA | Description |
|---|---|---|
| 1 | `a51f169` | ADR 0026/0027 "Update" sections recording the persistence-port and sync-ordering decisions, written before any code |
| 2 | `6bcca0d` | `expo-sqlite`, `drizzle-orm`, `expo-crypto`, `@react-native-community/netinfo` added; SQLCipher enabled via the `expo-sqlite` config plugin (`useSQLCipher`); `ios`/`android` regenerated via `expo prebuild` |
| 3 | `fee1efe` | `Store<T>` port, `SQLiteStore` adapter (expo-sqlite + Drizzle), hand-written migrations, `openDatabase()` (SQLCipher key from a new `secureStorage.getOrCreateDbKey()`, deliberately untouched by the per-restart token clear) |
| 4 | `8bbe273` | `VehicleRepository`, `OutboxRepository`, `DatabaseProvider` (owns the connection lifecycle, exposes only repositories via context) |
| 5 | `d2c3407` | `SyncService` (pull + `flushOutbox` + `RetryableOutboxError`), `SyncProvider` (mount/reconnect/foreground triggers, `isOnline`/`pendingCount`/`syncStatus`/`lastSyncedAt`/`refresh()`) |
| 6 | `f1afd69` | The Garage screen itself: `useGarageViewModel` + `GarageScreen` matching `revlog-mobile-garage.html`, `OfflineIndicator` component |
| 7 | `3cf830e` | Bugfix found during on-device verification: the root Stack was rendering its own transparent header over Garage's custom header (back-button chevron overlapping the wordmark) — root now hides its header for the whole `garage/` segment, delegating entirely to the nested layout |
| 8 | `d45691d` | Appium E2E spec (`garage.e2e.ts`): populated garage + Vehicle Detail navigation, empty state (ACTIVE account, zero Vehicles) + Add Vehicle navigation, FAB navigation; `authFixtures.ts` extended with `loginViaApi`/`createVehicleViaApi`/`deleteVehicleViaApi` |
| 9 | `d70a1a4` | Bugfix found while reconciling against `offline-sync.md`'s acceptance criteria: the offline indicator only checked `isOffline`, not `pendingCount` — an Owner back online with unsynced changes queued would see no indicator, per ADR 0027's stated rule |
| 10 | _(this commit)_ | Updates `garage.md` and `offline-sync.md` (status, acceptance criteria, Decisions, Out of scope) to match what was actually built; checks off the corresponding `v1.md` milestone items; this session summary |

---

## Verification

- **Jest**: `pnpm --filter @maintenance-log/mobile test` — 10 suites, 46 tests, all passing. New coverage: `Store<T>`-backed repositories (fake `Store`, no globals), `DatabaseProvider` (mocks only `openDatabase()`), `SyncService` (dispatch order, retryable-stop vs. permanent-continue, full-sync sequencing), `SyncProvider` (mount/no-session/error/online-state), `useGarageViewModel` (loading-state transitions, offline reflection, navigation callbacks).
- **`tsc --noEmit`**: clean throughout.
- **On-device smoke test (Step 2, since removed)**: `openDatabase()` + `createSQLiteStore` exercised directly on the iOS simulator against the real SQLCipher-encrypted database — `replaceAll` upsert/delete-absent, `getAll` with `where`/`orderBy`, `save`/`remove` all confirmed correct before building anything on top.
- **Appium E2E** (`pnpm e2e:ios`, all 4 specs): 13 tests passing — Welcome (3), Register (3), Login (4), Garage (3, new). Garage specs seed real backend state via direct API calls (register, verify via Mailpit, create/delete Vehicle) and drive the real app UI, confirming the full pipeline end-to-end: login → session → `SyncProvider` sync → `VehicleRepository` local write → `GarageViewModel` read → correct rendered card/empty-state content → correct navigation.
- **Visual review**: screenshots taken mid-E2E-run (temporary `saveScreenshot()` calls, removed before the final commit) confirmed both populated and empty states match `revlog-mobile-garage.html` closely, and caught the header-overlap bug (commit 7) that no text-content assertion would have.

---

## Out of scope

- `LogEntryRepository`, `AccountRepository`, multi-collection pull/reconcile — no screen needs them yet; the approach is documented (ADR 0027's update) for when Vehicle Detail/Log Entry land.
- Real outbox handlers (`CREATE_VEHICLE`, etc.) and the Idempotency-Key request header — Add Vehicle's responsibility; `POST /vehicles` also needs to start accepting a client-supplied `id` first (surfaced during the push-ordering design discussion, not implemented here).
- Settings gear icon / navigation from the Garage header — separate, not-yet-built milestone item; the approved design for this screen has no gear icon.
- Offline banner Appium coverage — no reliable cross-platform connectivity toggle in this WebdriverIO/Appium setup; verified by code/test review instead (`SyncProvider.test.tsx`, `useGarageViewModel.test.ts`) plus manual on-device inspection.
- `packages/api-client`/`HttpClient` redesign — the same category of leaky-port issue found and fixed for `Store<T>` (verb-shaped methods, e.g. `get`/`post`, leak REST/HTTP into what should be a generic port) also applies to `HttpClient`, but fixing it touches both apps' adapters and every service file in the shared package — flagged as a real follow-up, not actioned here.
- `packages/api-client/src/services/` → `repositories/` rename — related naming discussion (this codebase's "services" already structurally act as repositories over `HttpClient`); same repo-wide-change reasoning as above, not actioned.
- `apps/mobile`'s `lint` script has no `eslint` devDependency — pre-existing gap (flagged in an earlier session too), unrelated to this one; `tsc --noEmit` was used as the type-safety gate throughout instead.
