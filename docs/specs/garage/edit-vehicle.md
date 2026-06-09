# Edit Vehicle Spec

**Area:** Garage
**Status:** In progress
**Last updated:** 2026-06-09

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
- Form fields: Nickname (optional), Make, Model, Year, Mileage — all pre-filled from the initial GET
- Bottom bar: Cancel button (secondary) + Save button (primary)
- Save button shows a loading state while the PATCH is in flight
- Validation errors shown inline below each field

### Data flow

1. Mount → `GET /vehicles/:vehicleId` → populate form state
2. Submit → `PATCH /vehicles/:vehicleId` with `{ field: newValue }` for every field the user touched
3. 200 → `router.push('/garage/[vehicleId]')`
4. 4xx → show inline error message below the form
5. 403/404 on initial fetch → render not-found state

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
- [ ] E2E test: happy path — edit make/model, save, redirected to detail with updated values
- [ ] E2E test: cancel — no change persisted, detail screen shown

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| `PATCH` semantics (partial) | All fields optional; apply only provided fields | Owner may need to fix just one field; requiring all fields on every edit forces unnecessary data round-trips |
| 400 on empty body | Validated via Zod `.refine(() => Object.keys(data).length > 0)` | An empty PATCH is almost certainly a client bug; rejecting it prevents silent no-ops |
| Pre-fill from `GET /vehicles/:vehicleId` | Reuse the existing detail endpoint to populate the edit form | Avoids a duplicate endpoint; the detail response already carries all editable fields |
| `updateVehicleSchema = createVehicleSchema.partial()` | Zod `.partial()` on the create schema | Keeps validation rules in one place; partial() makes every field optional while preserving transforms |
| Redirect to detail on save | `router.push('/garage/[vehicleId]')` after 200 | Immediate confirmation that the update was applied; Owner sees the saved state right away |

---

## Out of scope (V2+)

- Photo edit/replace on the edit screen — photo upload exists on the detail screen via a separate flow
- Mileage decrease validation ("mileage must not be lower than the last log entry") — V2 guard
- Vehicle archiving / soft-delete — separate V2 feature
