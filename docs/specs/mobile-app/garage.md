# Mobile Garage Screen Spec

**Area:** Mobile / Garage
**Status:** Implemented — offline-first foundation (Store/SQLiteStore, VehicleRepository, OutboxRepository, SyncService, SyncProvider, DatabaseProvider) built alongside this screen, since none of it existed yet
**Last updated:** 2026-07-02

---

## Overview

The Garage screen lists all Vehicles belonging to the Owner's Account. Core use cases are the same as the web spec (`docs/specs/garage/garage-screen.md`). This spec covers mobile-specific behaviour only.

Mobile-specific differences:
- Data is read from local SQLite, not from the API directly. The screen is always fast to load, even offline.
- `SyncService` triggers a pull from the API on app foreground and on explicit pull-to-refresh.
- The offline indicator in the header signals when data may be stale or when writes are queued.

Design file: [`revlog-mobile-garage.html`](../../designs/mobile/revlog-mobile-garage.html)

---

## Use Cases

### UC-MOB-GARAGE-1 — Owner views their Garage

**Actor:** Owner
**Precondition:** Owner is authenticated; local SQLite is seeded (at least one prior sync has occurred).
**Milestones:** [V1](../../milestones/v1.md)

1. Owner opens the app or navigates to the Garage.
2. Screen reads Vehicles from local SQLite via `VehicleRepository`. Renders immediately.
3. `SyncService` initiates a background pull from the API. No loading spinner blocks the screen.
4. On sync completion: if Vehicle data has changed, the repository emits an update and the screen re-renders with fresh data.

---

### UC-MOB-GARAGE-2 — Owner views Garage on first launch (no local data)

**Actor:** Owner
**Precondition:** Owner just logged in for the first time on this device; local SQLite is empty.
**Milestones:** [V1](../../milestones/v1.md)

1. Screen renders a loading skeleton while `SyncService` performs the initial pull.
2. On sync completion: screen renders the Vehicle list (or empty state if the Owner has no Vehicles yet).

---

### UC-MOB-GARAGE-3 — Owner views Garage while offline

**Actor:** Owner
**Precondition:** Device has no connectivity; local SQLite is seeded.
**Milestones:** [V1](../../milestones/v1.md)

1. Screen reads Vehicles from local SQLite. Renders immediately with locally-cached data.
2. Offline indicator appears in the header.
3. Owner can tap any Vehicle and navigate to Vehicle Detail — all reads are local.

---

### UC-MOB-GARAGE-4 — Owner refreshes the Garage

**Actor:** Owner
**Precondition:** Owner is on the Garage screen; device is online.
**Milestones:** [V1](../../milestones/v1.md)

1. Owner pulls down to refresh.
2. `SyncService` flushes the outbox then pulls all Vehicles from the API.
3. On completion: screen reflects any server-side changes. Refresh indicator disappears.

---

### UC-MOB-GARAGE-5 — Owner adds a Vehicle from the Garage

**Actor:** Owner
**Precondition:** Owner is on the Garage screen.
**Milestones:** [V1](../../milestones/v1.md)

Owner taps the `[+]` floating action button. App navigates to the Add Vehicle screen.

---

### UC-MOB-GARAGE-6 — Empty state

**Actor:** Owner
**Precondition:** Owner's Account has no Vehicles (or all have been deleted).
**Milestones:** [V1](../../milestones/v1.md)

Screen renders the empty state: illustration, "Your garage is empty", and a `[Add your first vehicle]` button.

---

## Acceptance Criteria

- [x] Garage renders from local SQLite without waiting for the network
- [x] Background sync updates the Garage when new data arrives
- [x] First-launch (empty local DB) shows loading state until initial sync completes
- [x] Offline mode shows locally-cached data and offline indicator
- [x] Pull-to-refresh triggers outbox flush then API pull
- [x] Empty state is shown when no Vehicles exist
- [x] Tapping a Vehicle card navigates to Vehicle Detail
- [x] `[+]` button navigates to Add Vehicle screen

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Reads from local SQLite | Always — no direct API reads in the screen | Offline-first; SQLite reads are instant; see ADR 0027 |
| Background sync on mount | SyncProvider triggers pull on foreground | Keeps data fresh without blocking the UI |
| Pull-to-refresh | Flush outbox first, then pull | Ensures local writes reach the server before pulling, avoiding stale reconcile |
| Card meta line drops the design's "Last entry &lt;date&gt;" text | Meta reads `"${year} ${make} ${model}"` only; the existing entries-count badge conveys activity instead | `GET /vehicles` (`VehicleSummary`) has no last-logged-at field — only the per-vehicle detail endpoint does, and pulling per-vehicle detail for every Vehicle on every Garage sync is out of scope for this screen. Matches the web Garage screen's precedent of documenting a data-availability gap as a Decision rather than a silent deviation from the approved design |
| Outbox built now, unexercised until a write screen exists | `OutboxRepository` and `SyncService.flushOutbox()` are fully implemented and unit-tested (dispatch order, retryable-vs-permanent-failure handling) against an injected, currently-empty handler registry | Garage itself never writes — building the full outbox pipeline now (rather than deferring it) means Add Vehicle only needs to register a `CREATE_VEHICLE` handler, not design the dispatch mechanism. See ADR 0027's 2026-07-02 update for the ordering/client-generated-id decisions that handler will need |
| `Store<T>` persistence port, not a SQL-shaped `LocalDatabase` | `infrastructure/database/Store.ts`: `getAll`/`save`/`remove`/`replaceAll`, generic per entity, instantiated once per collection | ADR 0026's originally-specified port (`LocalDatabase`, raw `execute(sql)`/`query(sql)`) named the port after the adapter's technology and deployment fact rather than the capability it offers — corrected during this screen's implementation; see ADR 0026's 2026-07-02 update |
| No gear icon / Settings link in the Garage header | Header shows only the wordmark and (when offline) `OfflineIndicator` — matches `revlog-mobile-garage.html` exactly, which has no gear icon in this screen's mockup | Settings navigation (ADR 0028's "gear icon → /settings") is a separate, not-yet-built milestone item; adding it here would be scope creep beyond what the approved design for this screen shows |

---

## E2E tests (Appium)

- [x] Populated garage renders a Vehicle card with the correct name, meta, and entries badge; tapping it navigates to Vehicle Detail
- [x] An ACTIVE account with zero Vehicles (create-then-delete, since a never-onboarded account is ONBOARDING and routes to `/onboarding` instead) shows the empty state; its CTA navigates to Add Vehicle
- [x] The `[+]` FAB navigates to Add Vehicle
- [ ] Offline banner — not automated; this WebdriverIO/Appium setup has no reliable cross-platform connectivity toggle, and cutting the dev API would also break Metro's own connection to the app. Verified instead by code/test review: `SyncProvider.test.tsx` and `useGarageViewModel.test.ts` cover `isOnline`/`isOffline` propagation, and the screen's conditional rendering was confirmed by inspection and a manual on-device pass

---

## Out of scope

- `LogEntryRepository`, `AccountRepository`, and any multi-collection pull/reconcile — no Log Entry sync exists yet; see ADR 0027's 2026-07-02 update for the ordering approach this will use
- Real Outbox handlers (`CREATE_VEHICLE`, etc.) — Garage never writes; the dispatch mechanism is built and tested, handlers are Add Vehicle's responsibility
- Settings gear icon / navigation — separate, not-yet-built milestone item
- `packages/api-client`/`HttpClient` redesign — a related leaky-port issue found during this work's design review, but a repo-wide change out of scope for this screen (tracked as a follow-up, not an ADR yet)
