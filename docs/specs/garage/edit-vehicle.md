# Edit Vehicle Spec

**Area:** Garage
**Status:** In progress
**Last updated:** 2026-07-04

---

## Overview

Two deliverables that together let an Owner update a Vehicle's details:

1. **`PATCH /vehicles/:vehicleId`** — partial-update API endpoint
2. **`/garage/[vehicleId]/edit`** — pre-filled edit form screen

The edit screen is reached via the ✎ Edit button on the Vehicle Detail screen. On save it redirects back to the Vehicle Detail screen. On cancel it returns to the detail screen without changes.

---

## Use Cases

### UC-VEDIT-1 — Owner edits vehicle details

**Precondition:** The Owner is authenticated and the Vehicle belongs to their Account.

1. Owner taps ✎ Edit on the Vehicle Detail screen → navigates to `/garage/[vehicleId]/edit`.
2. The edit screen fetches the current vehicle from `GET /vehicles/:vehicleId` and pre-fills all form fields.
3. Owner modifies one or more fields (nickname, make, model, year, mileage).
4. Owner taps Save → form submits `PATCH /vehicles/:vehicleId` with only the changed fields.
5. On 200 the screen navigates to `/garage/[vehicleId]` (Vehicle Detail).

### UC-VEDIT-2 — Owner cancels the edit

**Precondition:** Owner is on `/garage/[vehicleId]/edit`.

1. Owner taps Cancel (or browser back).
2. Screen navigates to `/garage/[vehicleId]` without sending a request.

### UC-VEDIT-3 — Vehicle not found or forbidden

**Precondition:** The vehicleId in the URL does not exist or belongs to a different Account.

1. Edit screen fetches `GET /vehicles/:vehicleId` on mount.
2. API returns 403 or 404.
3. Screen shows an error state ("Vehicle not found") with a link back to `/garage`.

### UC-VEDIT-4 — Owner changes the vehicle photo

**Precondition:** The Owner is on `/garage/[vehicleId]/edit`.

1. The photo zone shows the Vehicle's current photo if one is set, otherwise an empty "Click to upload a photo" placeholder — same visual component as Add Vehicle's `photoZone`.
2. Owner clicks the zone and picks an image file. The zone immediately shows a local preview (an `×` button appears, letting the Owner discard this pending pick and revert to what's currently saved — this does not call the API).
3. Owner taps Save. The screen submits `PATCH /vehicles/:vehicleId` with the text fields, then — only if a new photo was picked — `POST /vehicles/:vehicleId/photo` with the file.
4. On both succeeding, the screen navigates to `/garage/[vehicleId]`, which shows the new photo.
5. If the PATCH fails, the screen behaves exactly as UC-VEDIT-1 step 5's failure case (inline error, no navigation, pending photo pick preserved).
6. If the PATCH succeeds but the photo upload fails, the screen shows an inline error ("Details saved, but the photo couldn't be uploaded. Try again.") and does not navigate — the Owner's non-photo changes are already saved, but they stay on the edit screen to retry the photo specifically.

---

## `PATCH /vehicles/:vehicleId`

### Request

```
PATCH /vehicles/:vehicleId
Authorization: Bearer <accessToken>
Content-Type: application/json
```

### Path parameters

| Parameter | Type | Rules |
|---|---|---|
| `vehicleId` | string (UUID) | Required; must be a non-empty string |

### Request body

All fields are optional. At least one must be present (400 if body is empty or all fields absent).

| Field | Type | Rules |
|---|---|---|
| `nickname` | string \| null | Trim whitespace; max 100 chars; `null` clears the nickname |
| `make` | string | Trim whitespace; min 1, max 100 chars |
| `model` | string | Trim whitespace; min 1, max 100 chars |
| `year` | number | Integer; min 1900, max current year + 1 |
| `mileage` | number | Integer; min 0, max 2 000 000 |

### Response — 200 OK

```json
{
  "vehicle": {
    "id": "uuid",
    "nickname": "Blackbird | null",
    "make": "Honda",
    "model": "CB650R",
    "year": 2019,
    "mileage": 12500,
    "photoUrl": "/uploads/vehicles/abc123.jpg | null"
  }
}
```

### Error responses

| Status | Body | When |
|---|---|---|
| 400 | `{ "error": "Validation error", "details": [...] }` | Invalid field values or empty body |
| 401 | `{ "error": "Missing or invalid authorization header" }` / `{ "error": "Invalid or expired access token" }` | No/invalid/expired bearer token |
| 403 | `{ "error": "Forbidden" }` | Vehicle exists but belongs to a different Account |
| 404 | `{ "error": "Vehicle not found" }` | No Vehicle with this ID |
| 500 | `{ "error": "Internal server error" }` | Unexpected failure |

### Three-layer responsibilities

**Route** (`apps/api/src/routes/vehicles.ts`):
- Validates request body with `updateVehicleSchema` (Zod partial of `createVehicleSchema`)
- Passes `vehicleId` and parsed body to `vehicleService.updateVehicle`
- Returns 200 with updated vehicle, or delegates errors via `next(err)`

**Service** (`apps/api/src/services/VehicleService.ts`):
- Calls `vehicleRepo.findById(vehicleId)` (or `findDetailById`) to check existence and ownership
- If not found → throws `AppError` (404)
- If `accountId` mismatch → throws `AppError` (403)
- Calls `vehicleRepo.update(vehicleId, data)` with the validated partial fields
- Returns the updated vehicle domain object

**Repository** (`apps/api/src/repositories/VehicleRepository.ts`):
- `update(vehicleId, data)` — `prisma.vehicle.update({ where: { id: vehicleId }, data })`
- Returns a `DomainVehicle` shaped result

---

## `/garage/[vehicleId]/edit` Screen

### Layout

- Top bar: "Edit Vehicle" heading with a back-arrow that cancels (navigates to detail)
- Photo zone: current photo (or an empty placeholder), reusing Add Vehicle's `photoZone` component — click to pick a replacement; an `×` appears once a replacement is picked, to discard that pending pick
- Form fields: Nickname (optional), Make, Model, Year, Mileage — all pre-filled from the initial GET
- Bottom bar: Cancel button (secondary) + Save button (primary)
- Save button shows a loading state while the PATCH (and, if a photo was picked, the photo POST) is in flight
- Validation errors shown inline below each field

### Data flow

1. Mount → `GET /vehicles/:vehicleId` → populate form state and the photo zone's current photo
2. Submit → `PATCH /vehicles/:vehicleId` with `{ field: newValue }` for every field the user touched
3. If a new photo was picked → `POST /vehicles/:vehicleId/photo` (multipart), only after the PATCH succeeds
4. Both succeed → `router.push('/garage/[vehicleId]')`
5. PATCH fails (4xx) → show inline error message below the form; pending photo pick is preserved
6. PATCH succeeds but the photo POST fails → show an inline error specific to the photo; do not navigate (the field changes are already saved)
7. 403/404 on initial fetch → render not-found state

### Form field rules (client-side validation mirrors API)

| Field | Required | Constraints |
|---|---|---|
| Nickname | No | Max 100 chars |
| Make | Yes | 1–100 chars |
| Model | Yes | 1–100 chars |
| Year | Yes | Integer, 1900 – current year + 1 |
| Mileage | Yes | Integer, 0 – 2 000 000 |

---

## Domain changes

### `updateVehicleSchema` (`packages/domain/src/schemas/vehicle.ts`)

```typescript
export const updateVehicleSchema = createVehicleSchema.partial();
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
```

`createVehicleSchema.partial()` makes all fields optional while preserving the same transforms and constraints.

### `IVehicleRepository.update` (`packages/domain/src/vehicle/index.ts`)

```typescript
update(vehicleId: string, data: UpdateVehicleInput): Promise<DomainVehicle>;
```

---

## Acceptance Criteria

### API

- [ ] `PATCH /vehicles/:vehicleId` with a valid token and partial body returns 200 with updated vehicle
- [ ] All five fields (`nickname`, `make`, `model`, `year`, `mileage`) can be updated independently
- [ ] `nickname: null` clears the nickname field
- [ ] Vehicle belonging to a different Account returns 403
- [ ] Non-existent Vehicle ID returns 404
- [ ] Empty body (no fields) returns 400
- [ ] Invalid field values (e.g. year out of range) return 400
- [ ] Missing or invalid bearer token returns 401
- [ ] Unit test: happy path — single field update
- [ ] Unit test: full update (all fields)
- [ ] Unit test: 403 when accountId does not match
- [ ] Unit test: 404 when vehicle not found
- [ ] Unit test: 400 for empty body

### Screen

- [ ] `/garage/[vehicleId]/edit` pre-fills all form fields from `GET /vehicles/:vehicleId`
- [ ] Save button submits PATCH and shows loading state
- [ ] Successful save redirects to `/garage/[vehicleId]`
- [ ] Cancel navigates to `/garage/[vehicleId]` without sending a request
- [ ] Inline validation errors appear for invalid inputs
- [ ] 403/404 on initial fetch renders not-found state with link to `/garage`
- [ ] API error on save renders inline error below the form
- [ ] Photo zone shows the Vehicle's current photo when set, else an empty placeholder
- [ ] Picking a new photo shows a local preview and an `×` to discard the pending pick (reverting to the current photo, without calling the API)
- [ ] Saving with a newly-picked photo calls `PATCH` then `POST /vehicles/:vehicleId/photo`, and navigates to detail only once both succeed
- [ ] Saving with no new photo picked never calls `POST /vehicles/:vehicleId/photo`
- [ ] A photo upload failure after a successful PATCH shows an inline photo-specific error and does not navigate away
- [ ] E2E test: happy path — edit make/model, save, redirected to detail with updated values
- [ ] E2E test: cancel — no change persisted, detail screen shown
- [ ] E2E test: change photo — pick a new photo, save, detail screen shows the new photo

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| `PATCH` semantics (partial) | All fields optional; apply only provided fields | Owner may need to fix just one field; requiring all fields on every edit forces unnecessary data round-trips |
| 400 on empty body | Validated via Zod `.refine(() => Object.keys(data).length > 0)` | An empty PATCH is almost certainly a client bug; rejecting it prevents silent no-ops |
| Pre-fill from `GET /vehicles/:vehicleId` | Reuse the existing detail endpoint to populate the edit form | Avoids a duplicate endpoint; the detail response already carries all editable fields |
| `updateVehicleSchema = createVehicleSchema.partial()` | Zod `.partial()` on the create schema | Keeps validation rules in one place; partial() makes every field optional while preserving transforms |
| Redirect to detail on save | `router.push('/garage/[vehicleId]')` after 200 | Immediate confirmation that the update was applied; Owner sees the saved state right away |
| Photo change ships on the edit screen, not a separate detail-screen flow (supersedes this file's earlier "Out of scope" cut) | Reuses the existing `POST /vehicles/:vehicleId/photo` endpoint (already built for Add Vehicle's create-with-photo path and already unit-tested on the API); the edit screen calls it as a second request after the PATCH succeeds | The API has no endpoint that accepts both the JSON field patch and a multipart photo in one request — `PATCH /vehicles/:vehicleId` is JSON-only. Two sequential requests from the same Save action is the smallest change that reuses both existing endpoints without adding a combined-multipart-PATCH endpoint that nothing else needs |
| No "remove photo to none" affordance | The `×` on a freshly-picked preview only discards *that pending pick*, reverting to the currently-saved photo (or the empty placeholder if there was none) — it never calls the API | There is no API endpoint to clear an existing photo back to null; adding one is out of scope here since the Owner asked for the ability to *change* the photo, not remove it |
| Photo POST fires only after the PATCH succeeds, not in parallel | Sequential, not `Promise.all` | Keeps the two requests' error states unambiguous — if the PATCH fails, nothing about the photo has been attempted yet, so the pending pick is simply preserved for a retry after fixing the field errors |

---

## Out of scope (V2+)

- Removing an existing photo back to "none" — see the Decisions table above
- Mileage decrease validation ("mileage must not be lower than the last log entry") — V2 guard

## Related specs

- [`delete-vehicle.md`](./delete-vehicle.md) — danger zone at the bottom of this screen; permanent hard delete with confirmation dialog
