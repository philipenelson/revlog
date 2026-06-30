# Mobile Garage Screen Spec

**Area:** Mobile / Garage
**Status:** Not started
**Last updated:** 2026-06-30

---

## Overview

The Garage screen lists all Vehicles belonging to the Owner's Account. Core use cases are the same as the web spec (`docs/specs/garage/garage-screen.md`). This spec covers mobile-specific behaviour only.

Mobile-specific differences:
- Data is read from local SQLite, not from the API directly. The screen is always fast to load, even offline.
- `SyncService` triggers a pull from the API on app foreground and on explicit pull-to-refresh.
- The offline indicator in the header signals when data may be stale or when writes are queued.

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

- [ ] Garage renders from local SQLite without waiting for the network
- [ ] Background sync updates the Garage when new data arrives
- [ ] First-launch (empty local DB) shows loading state until initial sync completes
- [ ] Offline mode shows locally-cached data and offline indicator
- [ ] Pull-to-refresh triggers outbox flush then API pull
- [ ] Empty state is shown when no Vehicles exist
- [ ] Tapping a Vehicle card navigates to Vehicle Detail
- [ ] `[+]` button navigates to Add Vehicle screen

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Reads from local SQLite | Always — no direct API reads in the screen | Offline-first; SQLite reads are instant; see ADR 0027 |
| Background sync on mount | SyncProvider triggers pull on foreground | Keeps data fresh without blocking the UI |
| Pull-to-refresh | Flush outbox first, then pull | Ensures local writes reach the server before pulling, avoiding stale reconcile |
