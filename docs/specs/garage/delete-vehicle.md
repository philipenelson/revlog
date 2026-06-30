# Delete Vehicle Spec

**Area:** Garage
**Route:** `/garage/[vehicleId]/edit` (danger zone)
**Status:** Not started
**Last updated:** 2026-06-28

---

## Overview

Owners can permanently delete a Vehicle from their Garage. Deletion is irreversible: all Log Entries, Items, Media, and Insurance associated with the Vehicle are hard-deleted in a single cascaded database operation. The action is surfaced in a danger zone at the bottom of the Edit Vehicle screen, gated by a confirmation dialog, to prevent accidental removal.

A Vehicle with a pending Vehicle Transfer cannot be deleted — the Edit Vehicle screen is unreachable when a Transfer is pending (the Vehicle Detail screen locks all navigation to Edit during that state).

---

## Use Cases

### UC-VDELETE-1 — Owner permanently deletes a vehicle

**Actor:** Owner
**Precondition:** Owner is authenticated; Vehicle belongs to their Account; no pending Vehicle Transfer for this Vehicle.
**Milestones:** [V1](../../milestones/v1.md)

1. Owner navigates to `/garage/[vehicleId]/edit`.
2. Owner scrolls to the danger zone at the bottom of the form and selects `[Delete vehicle]`.
3. System opens a confirmation dialog: "Delete [Nickname or Make Model]? All log entries, items, media, and insurance will be permanently removed. This cannot be undone."
4. Owner selects `[Delete]` to confirm.
5. System calls `DELETE /vehicles/:vehicleId` and shows a loading state on the confirm button.
6. On 204, system navigates to `/garage`.

### UC-VDELETE-2 — Owner cancels the delete confirmation

**Actor:** Owner
**Precondition:** Delete confirmation dialog is open.
**Milestones:** [V1](../../milestones/v1.md)

1. Owner selects `[Cancel]` or dismisses the dialog (click outside, Escape key).
2. Dialog closes; Owner remains on the Edit Vehicle screen. No request is sent.

---

## `DELETE /vehicles/:vehicleId`

### Request

```
DELETE /vehicles/:vehicleId
Authorization: Bearer <accessToken>
```

### Path parameters

| Parameter | Type | Rules |
|---|---|---|
| `vehicleId` | string (UUID) | Required; must be a non-empty string |

### Response — 204 No Content

Empty body.

### Error responses

| Status | Body | When |
|---|---|---|
| 401 | `{ "error": "Missing or invalid authorization header" }` | No/invalid/expired bearer token |
| 403 | `{ "error": "Forbidden" }` | Vehicle exists but belongs to a different Account |
| 404 | `{ "error": "Vehicle not found" }` | No Vehicle with this ID |
| 500 | `{ "error": "Internal server error" }` | Unexpected failure |

### Three-layer responsibilities

**Route** (`apps/api/src/routes/vehicles.ts`):
- Extracts `vehicleId` from path params and validates it is a non-empty string
- Calls `vehicleService.deleteVehicle(vehicleId, accountId)`
- Returns 204 on success, or delegates errors via `next(err)`

**Service** (`apps/api/src/services/VehicleService.ts`):
- Calls `vehicleRepo.findById(vehicleId)` to check existence and ownership
- If not found → throws `AppError` (404)
- If `accountId` mismatch → throws `AppError` (403)
- Calls `vehicleRepo.delete(vehicleId)`

**Repository** (`apps/api/src/repositories/VehicleRepository.ts`):
- `delete(vehicleId)` — `prisma.vehicle.delete({ where: { id: vehicleId } })`
- Cascades handled by Prisma schema (`onDelete: Cascade` on `LogEntry`, `VehicleInsurance`)

---

## Edit Vehicle screen — Danger zone

### Layout addition

A clearly separated danger zone section is rendered at the bottom of the Edit Vehicle form, below the Save / Cancel actions:

- Red/danger-coloured border and background tint
- Heading: "Danger zone"
- Body text: "Permanently delete this vehicle and all its log entries. This cannot be undone."
- A single `[Delete vehicle]` button in destructive style (red border, red text)

### Confirmation dialog

Triggered by `[Delete vehicle]`:

- Title: "Delete vehicle?"
- Body: "**[Nickname or Make Model]** and all its log entries, items, media, and insurance will be permanently removed. This cannot be undone."
- Actions: `[Delete]` (destructive primary) · `[Cancel]` (secondary)
- `[Delete]` shows a loading state while `DELETE /vehicles/:vehicleId` is in flight
- On 204: dialog closes, navigate to `/garage`
- On error: dialog stays open, shows an inline error message below the actions

---

## Domain changes

### `IVehicleRepository.delete` (`packages/domain/src/vehicle/index.ts`)

```typescript
delete(vehicleId: string): Promise<void>;
```

### No schema migration required

`LogEntry`, `VehicleInsurance` already have `onDelete: Cascade` in the Prisma schema. `LogItem` and `LogMedia` cascade from `LogEntry`. No new migrations needed.

---

## Acceptance Criteria

### API

- [ ] `DELETE /vehicles/:vehicleId` with a valid token returns 204 and removes the Vehicle
- [ ] All associated LogEntries, LogItems, LogMedia, and VehicleInsurance are removed with the Vehicle
- [ ] Vehicle belonging to a different Account returns 403
- [ ] Non-existent Vehicle ID returns 404
- [ ] Missing or invalid bearer token returns 401
- [ ] Unit test: happy path — vehicle deleted, 204 returned
- [ ] Unit test: 403 when accountId does not match
- [ ] Unit test: 404 when vehicle not found

### Screen

- [ ] Danger zone is rendered below Save / Cancel on `/garage/[vehicleId]/edit`
- [ ] `[Delete vehicle]` opens the confirmation dialog
- [ ] Dialog shows the Vehicle display name (Nickname or Make Model) in the body
- [ ] `[Cancel]` closes the dialog without sending any request
- [ ] Clicking outside the dialog or pressing Escape closes it without action
- [ ] `[Delete]` shows a loading state while the request is in flight
- [ ] On 204, screen navigates to `/garage`
- [ ] On API error, dialog stays open and shows an inline error message
- [ ] E2E test: open dialog → cancel → no deletion; open dialog → confirm → navigated to `/garage`; vehicle no longer appears in Garage list

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Hard delete, no soft-delete | `DELETE` cascades all data permanently | Revlog is a personal log; when an Owner removes a Vehicle they are ending its record. Soft-delete adds schema complexity for a recovery use case that hasn't been asked for |
| Danger zone on Edit screen, not Detail screen | Surfaced at bottom of `/garage/[vehicleId]/edit` | Detail screen is a read-focused hub for daily use; destructive actions belong behind an extra navigation step to prevent accidents |
| Confirmation dialog required | Dialog before any request | Deletion is irreversible; a single mis-tap must not destroy a vehicle's entire service history |
| Cascade via Prisma schema | `onDelete: Cascade` already present | No application-level loop needed; database handles referential cleanup atomically |

---

## Out of scope

- Soft-delete / archiving → not planned
- Bulk vehicle deletion → not planned
- Recovery or undo → not planned
