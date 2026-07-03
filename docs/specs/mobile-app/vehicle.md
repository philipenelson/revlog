# Mobile Vehicle Screens Spec

**Area:** Mobile / Vehicle
**Status:** In progress — Vehicle Detail (UC-MOB-VEH-1, UC-MOB-VEH-5 read-only) implemented; Edit Vehicle (UC-MOB-VEH-3) in progress; Add/Delete not started
**Last updated:** 2026-07-03

---

## Overview

Vehicle screens on mobile cover: Vehicle Detail, Add Vehicle, Edit Vehicle, and Delete Vehicle. Core use cases mirror the web specs (`docs/specs/garage/vehicle-detail-screen.md`, `docs/specs/garage/edit-vehicle.md`, `docs/specs/garage/delete-vehicle.md`). This spec covers mobile-specific behaviour.

Mobile-specific differences:
- All reads come from local SQLite via `VehicleRepository`.
- Write operations (create, update, delete) apply to local SQLite and are queued in the outbox. The UI responds immediately; sync to the API happens in the background.
- Vehicle photos are displayed when available (fetched URL from API response cached locally) but upload is V2.

Design files: [`revlog-mobile-vehicle-detail.html`](../../designs/mobile/revlog-mobile-vehicle-detail.html) · [`revlog-mobile-add-vehicle.html`](../../designs/mobile/revlog-mobile-add-vehicle.html) · [`revlog-mobile-edit-vehicle.html`](../../designs/mobile/revlog-mobile-edit-vehicle.html)

---

## Use Cases

### UC-MOB-VEH-1 — Owner views Vehicle Detail

**Actor:** Owner
**Precondition:** Owner is on the Garage screen; at least one Vehicle exists locally.
**Milestones:** [V1](../../milestones/v1.md)

1. Owner taps a Vehicle card.
2. App navigates to the Vehicle Detail screen.
3. Screen reads Vehicle data (identity, insurance, log entries) from local SQLite via `VehicleRepository` and `LogEntryRepository`.
4. Renders immediately from local data. Background sync may update the data if the device is online.

---

### UC-MOB-VEH-2 — Owner adds a Vehicle

**Actor:** Owner
**Precondition:** Owner is on the Garage screen; taps `[+]`.
**Milestones:** [V1](../../milestones/v1.md)

1. Owner fills in: make, model, year, nickname (optional), current mileage.
2. Taps `[Save]`.
3. App validates the form (same rules as web spec).
4. On valid: writes new Vehicle to local SQLite; adds `CREATE_VEHICLE` outbox entry in the same transaction. Navigates to the new Vehicle's Detail screen.
5. SyncService sends the outbox entry to the API when online.

---

### UC-MOB-VEH-3 — Owner edits a Vehicle

**Actor:** Owner
**Precondition:** Owner is on Vehicle Detail; taps `[Edit]`.
**Milestones:** [V1](../../milestones/v1.md)

1. Edit Vehicle screen pre-fills with current Vehicle data from local SQLite.
2. Owner modifies fields and taps `[Save]`.
3. App validates and writes the update to local SQLite; adds `UPDATE_VEHICLE` outbox entry.
4. Navigates back to Vehicle Detail with updated data.

---

### UC-MOB-VEH-4 — Owner deletes a Vehicle

**Actor:** Owner
**Precondition:** Owner is on the Edit Vehicle screen.
**Milestones:** [V1](../../milestones/v1.md)

1. Owner taps `[Delete vehicle]` in the danger zone.
2. App shows confirmation dialog: "Delete [Vehicle name]? This will permanently delete the vehicle and all its log entries. This cannot be undone."
3. Owner confirms.
4. App deletes the Vehicle and all related records from local SQLite (cascade); adds `DELETE_VEHICLE` outbox entry.
5. Navigates back to the Garage. SyncService propagates the hard delete to the API.

---

### UC-MOB-VEH-5 — Owner views a Vehicle with a pending transfer

**Actor:** Owner
**Precondition:** A `TRANSFER_VEHICLE` outbox entry has been sent; API has a pending transfer for this Vehicle.
**Milestones:** [V1](../../milestones/v1.md)

1. Vehicle Detail screen shows the Vehicle as locked: "Transfer pending — awaiting [recipient email]'s response."
2. Add Log Entry and Share Report actions are disabled (Edit and Delete live on screens not yet built).
3. Owner can cancel the transfer (adds `CANCEL_TRANSFER` outbox entry; Vehicle unlocks locally) — **implemented on `docs/specs/mobile-app/vehicle-transfer.md`'s Initiate Transfer screen, not here**; see this file's Decisions for why.

---

## Acceptance Criteria

- [x] Vehicle Detail reads from local SQLite — renders without network
- [ ] Add Vehicle writes to SQLite + outbox in one transaction; navigates to detail on success
- [ ] Edit Vehicle pre-fills from SQLite; writes update to SQLite + outbox on save
- [ ] Delete Vehicle shows confirmation dialog; cascade-deletes from SQLite + queues outbox entry
- [x] Transfer-pending Vehicle shows locked state; action buttons disabled
- [x] Vehicle photo URL is displayed when cached locally; placeholder shown when absent
- [ ] All form validation rules match the web spec (year range, required fields, mileage non-negative)

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Writes via outbox | SQLite + outbox in one transaction | Guarantees consistency: UI update and sync intent are atomic |
| Vehicle photo upload | V2 | Camera/library access requires additional native modules; scope kept for V2 |
| Delete cascade | Local SQLite cascade + single `DELETE_VEHICLE` outbox entry | API hard-delete cascades server-side; single outbox entry is sufficient |
| Vehicle Detail: insurance not displayed | No insurance row/dialog on mobile Vehicle Detail in V1, unlike the web spec | `revlog-mobile-vehicle-detail.html` has no insurance affordance in either state; no mobile spec has designed insurance edit UX yet. `SyncService` fetches `insurance` per ADR 0027's 2026-07-03 update but discards it — nothing reads it. Revisit as its own spec when mobile insurance UX is designed, rather than bolting a web-parity row onto this screen |
| Vehicle Detail: transfer-pending is read-only | Detail shows the locked banner (UC-MOB-VEH-5 steps 1–2) but no `[Cancel transfer]` action | Cancelling requires an `INITIATE_TRANSFER`/`CANCEL_TRANSFER` outbox handler and `transferService` wiring that don't exist yet — `SyncService.flushOutbox()` marks any entry with no registered handler `failed` permanently (see SyncService.ts), so enqueueing `CANCEL_TRANSFER` before its handler exists would silently and permanently no-op the cancellation. That handler pairs naturally with `INITIATE_TRANSFER`, both squarely in `docs/specs/mobile-app/vehicle-transfer.md`'s scope, so the cancel affordance ships there instead |
| Vehicle Detail: no type filter / sort control | Service history always renders newest-first, no filter dropdown | Unlike the web spec, this file's Acceptance Criteria and the design file never called for one; keeps V1 scope matched to what's actually specified here |
| Vehicle Detail: stats sourced from per-vehicle API fetch, not client computation | `stats.totalSpent`/`stats.lastLoggedAt` come from `GET /vehicles/:vehicleId` and are cached locally, not summed from local Log Entries | Mirrors the web spec's "stats computed server-side" decision; avoids a second, possibly-divergent computation living in the mobile client. See ADR 0027's 2026-07-03 update |
| Edit Vehicle ships without the danger zone | This pass implements only UC-MOB-VEH-3 (pre-fill, validate, save). `revlog-mobile-edit-vehicle.html` designs a Danger zone / delete-vehicle confirmation on the same screen, but that's UC-MOB-VEH-4, a distinct use case with its own outbox entry type (`DELETE_VEHICLE`), cascade semantics, and confirmation dialog | Same reasoning as Vehicle Detail's cancel-transfer deferral: bolting delete onto this pass means shipping a `DELETE_VEHICLE` outbox entry with no registered handler, which `SyncService.flushOutbox()` would mark permanently `failed`. Delete ships as its own step once it has a handler |
| Edit Vehicle form validation reuses `createVehicleSchema` from `@maintenance-log/domain`, not a hand-duplicated draft validator | Form fields are plain strings (mirrors web's `VehicleDraft`, avoids react-hook-form's type friction with `createVehicleSchema`'s `nickname` transform); on submit, the draft is parsed with `createVehicleSchema.safeParse()` and Zod's `fieldErrors` become the inline error state | Keeps the exact same field rules as the API and the web form without a second, hand-maintained copy of the regex/range checks — matches this file's own acceptance criterion "form validation rules match the web spec" more faithfully than re-deriving them |
| Edit Vehicle write path: `OutboxWriter<T>`, not `Store<T>.save()` + `OutboxRepository.enqueue()` | `VehicleRepository.update()` writes the vehicle row and enqueues the `UPDATE_VEHICLE` outbox entry in one `db.transaction()` via a new `OutboxWriter<T>` port | `Store<T>` is scoped to one table; a sequential save-then-enqueue isn't atomic and could lose an edit on a crash between the two calls, which is exactly what this ADR's outbox pattern exists to prevent. See ADR 0027's 2026-07-03 update |

---

## Out of scope

- Vehicle photo upload → V2
- Vehicle makes/models/years reference dataset → tracked in web V1 milestone; same deferral applies to mobile
- Insurance display/edit on mobile Vehicle Detail → needs its own spec (see Decisions above)
- Cancel transfer action on mobile Vehicle Detail → ships with `docs/specs/mobile-app/vehicle-transfer.md`'s Initiate Transfer screen
- Type filter / sort control on mobile Service History → not specified for V1
- Danger zone / Delete Vehicle (UC-MOB-VEH-4) on the Edit Vehicle screen → its own step, needs a `DELETE_VEHICLE` outbox handler and confirmation dialog (see Decisions above)
