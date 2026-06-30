# Mobile Vehicle Screens Spec

**Area:** Mobile / Vehicle
**Status:** Not started
**Last updated:** 2026-06-30

---

## Overview

Vehicle screens on mobile cover: Vehicle Detail, Add Vehicle, Edit Vehicle, and Delete Vehicle. Core use cases mirror the web specs (`docs/specs/garage/vehicle-detail-screen.md`, `docs/specs/garage/edit-vehicle.md`, `docs/specs/garage/delete-vehicle.md`). This spec covers mobile-specific behaviour.

Mobile-specific differences:
- All reads come from local SQLite via `VehicleRepository`.
- Write operations (create, update, delete) apply to local SQLite and are queued in the outbox. The UI responds immediately; sync to the API happens in the background.
- Vehicle photos are displayed when available (fetched URL from API response cached locally) but upload is V2.

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

1. Vehicle Detail screen shows the Vehicle as locked: "Transfer pending — awaiting recipient response."
2. Add Log Entry, Edit Vehicle, Share Report, and Delete buttons are disabled.
3. Owner can cancel the transfer (adds `CANCEL_TRANSFER` outbox entry; Vehicle unlocks locally).

---

## Acceptance Criteria

- [ ] Vehicle Detail reads from local SQLite — renders without network
- [ ] Add Vehicle writes to SQLite + outbox in one transaction; navigates to detail on success
- [ ] Edit Vehicle pre-fills from SQLite; writes update to SQLite + outbox on save
- [ ] Delete Vehicle shows confirmation dialog; cascade-deletes from SQLite + queues outbox entry
- [ ] Transfer-pending Vehicle shows locked state; action buttons disabled
- [ ] Vehicle photo URL is displayed when cached locally; placeholder shown when absent
- [ ] All form validation rules match the web spec (year range, required fields, mileage non-negative)

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Writes via outbox | SQLite + outbox in one transaction | Guarantees consistency: UI update and sync intent are atomic |
| Vehicle photo upload | V2 | Camera/library access requires additional native modules; scope kept for V2 |
| Delete cascade | Local SQLite cascade + single `DELETE_VEHICLE` outbox entry | API hard-delete cascades server-side; single outbox entry is sufficient |

---

## Out of scope

- Vehicle photo upload → V2
- Vehicle makes/models/years reference dataset → tracked in web V1 milestone; same deferral applies to mobile
