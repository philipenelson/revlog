# Log Entry API Spec

**Area:** Garage
**Status:** Not started
**Last updated:** 2026-06-09

---

## Overview

Backend implementation of the Log Entry CRUD endpoints under `/vehicles/:vehicleId/log`. These endpoints back the Log Entry screen (create and edit modes) and the Vehicle Detail screen's service history list.

All endpoints require authentication and vehicle ownership verification — the Vehicle must belong to the authenticated User's Account.

A key side effect on create and update: if the request includes a `mileage` value that exceeds the Vehicle's current `mileage`, the Vehicle's odometer is updated automatically. The odometer is never decremented.

---

## POST /vehicles/:vehicleId/log

Creates a new Log Entry for the Vehicle.

### Request

```
POST /vehicles/:vehicleId/log
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "typeId": "string — required; must match a LogEntryType.id",
  "title": "string — required, max 100 characters",
  "date": "ISO 8601 date string — required (e.g. '2025-06-03')",
  "time": "string — optional, 'HH:mm' format",
  "mileage": "number — optional, positive integer",
  "notes": "string — optional, max 5000 characters",
  "items": [
    {
      "categoryId": "string — required per item; must match an ItemCategory.id",
      "description": "string — required per item, max 500 characters",
      "quantity": "number — optional, positive decimal (default 1)",
      "unitCost": "number — optional, decimal ≥ 0"
    }
  ],
  "media": [
    {
      "path": "string — required per media; opaque storage ref (OPFS path in V1)",
      "mediaType": "IMAGE | VIDEO — required per media",
      "caption": "string — optional, max 300 characters",
      "sortOrder": "number — optional, integer (default 0)"
    }
  ]
}
```

`items` and `media` default to empty arrays if omitted.

### Input sanitization

Applied via Zod transforms in `createLogEntrySchema` (`packages/domain/src/schemas/`):

| Field | Transform |
|---|---|
| `title` | Trim whitespace; required non-empty after trim |
| `notes` | Trim whitespace; empty string after trim → `null` |
| `time` | Validate matches `HH:mm` pattern (00:00–23:59); invalid → 400 |
| `mileage` | Coerce to integer; must be ≥ 0 |
| `items[].description` | Trim whitespace; required non-empty after trim |
| `items[].quantity` | Coerce to decimal; must be > 0 if provided |
| `items[].unitCost` | Coerce to decimal; must be ≥ 0 if provided |
| `media[].caption` | Trim whitespace; empty string after trim → `null` |
| `typeId` | Must match a known `LogEntryType.id` (validated against DB) |
| `items[].categoryId` | Must match a known `ItemCategory.id` (validated against DB) |

### Response — 201 Created

```json
{
  "logEntry": {
    "id": "uuid",
    "typeId": "MAINTENANCE",
    "title": "Oil & filter change",
    "date": "2025-06-03",
    "time": "14:30 | null",
    "mileage": 12400,
    "notes": "Full synthetic 10W-40 | null",
    "items": [
      {
        "id": "uuid",
        "categoryId": "PART",
        "description": "Castrol Power 1 10W-40 1L",
        "quantity": "3",
        "unitCost": "9.50",
        "totalCost": "28.50"
      }
    ],
    "media": [
      {
        "id": "uuid",
        "path": "opfs://logentries/abc/img1.jpg",
        "mediaType": "IMAGE",
        "caption": null,
        "sortOrder": 0
      }
    ],
    "totalCost": "85.00 | null",
    "createdAt": "2025-06-03T14:30:00Z"
  }
}
```

`item.totalCost` is `quantity * unitCost`; `null` if either is absent. `logEntry.totalCost` is the sum across all items.

### Side effect — mileage auto-update

If `mileage` is provided and `mileage > vehicle.mileage`, the service runs:
```sql
UPDATE vehicles SET mileage = :mileage WHERE id = :vehicleId AND mileage < :mileage
```
This is a conditional update (no-op if another write raced ahead). The Vehicle's mileage is never decremented.

### Error responses

| Status | Body | When |
|---|---|---|
| 400 | `{ "error": "Invalid input", "details": [...] }` | Zod validation failure; unknown typeId or categoryId |
| 401 | `{ "error": "..." }` | No/invalid/expired bearer token |
| 403 | `{ "error": "Forbidden" }` | Vehicle belongs to another account |
| 404 | `{ "error": "Vehicle not found" }` | Vehicle ID does not exist |
| 500 | `{ "error": "Internal server error" }` | Unexpected failure |

---

## GET /vehicles/:vehicleId/log

Returns a summary list of Log Entries for a Vehicle.

### Request

```
GET /vehicles/:vehicleId/log?typeId=MAINTENANCE
Authorization: Bearer <accessToken>
```

Optional query param: `typeId` — filters entries to this type only.

### Response — 200 OK

```json
{
  "logEntries": [
    {
      "id": "uuid",
      "typeId": "MAINTENANCE",
      "title": "Oil & filter change",
      "date": "2025-06-03",
      "time": "14:30 | null",
      "mileage": 12400,
      "itemCount": 3,
      "mediaCount": 2,
      "totalCost": "85.00 | null"
    }
  ]
}
```

Sorted by `date` descending.

### Error responses

| Status | Body | When |
|---|---|---|
| 400 | `{ "error": "Invalid input" }` | `typeId` query param is not a known type ID |
| 401 | `{ "error": "..." }` | No/invalid/expired bearer token |
| 403 | `{ "error": "Forbidden" }` | Vehicle belongs to another account |
| 404 | `{ "error": "Vehicle not found" }` | Vehicle ID does not exist |
| 500 | `{ "error": "Internal server error" }` | Unexpected failure |

---

## GET /vehicles/:vehicleId/log/:entryId

Returns a single Log Entry with full items and media.

### Request

```
GET /vehicles/:vehicleId/log/:entryId
Authorization: Bearer <accessToken>
```

### Response — 200 OK

Same shape as the POST 201 response body.

### Error responses

| Status | Body | When |
|---|---|---|
| 401 | `{ "error": "..." }` | No/invalid/expired bearer token |
| 403 | `{ "error": "Forbidden" }` | Vehicle belongs to another account |
| 404 | `{ "error": "Vehicle not found" }` | Vehicle ID does not exist |
| 404 | `{ "error": "Log entry not found" }` | Entry does not exist or does not belong to this vehicle |
| 500 | `{ "error": "Internal server error" }` | Unexpected failure |

---

## PATCH /vehicles/:vehicleId/log/:entryId

Updates an existing Log Entry. Scalar fields are updated individually (partial update). Items and media are **full replacements** — the request body must include the complete desired array; the service deletes existing rows and inserts the new ones.

### Request

```
PATCH /vehicles/:vehicleId/log/:entryId
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Same body shape as POST, but all fields are optional. Only provided scalar fields are updated. If `items` is provided (even as `[]`), all existing items are replaced. If `media` is provided (even as `[]`), all existing media refs are replaced.

### Input sanitization

Same transforms as POST for each provided field.

### Response — 200 OK

Full Log Entry object (same shape as POST 201).

### Side effect — mileage auto-update

Same conditional update as POST if `mileage` is provided.

### Error responses

Same as POST plus 404 "Log entry not found" if the entry does not exist or does not belong to the given vehicle.

---

## DELETE /vehicles/:vehicleId/log/:entryId

Deletes a Log Entry and cascades to its items and media records.

### Request

```
DELETE /vehicles/:vehicleId/log/:entryId
Authorization: Bearer <accessToken>
```

### Response — 204 No Content

### Notes

- Deleting a Log Entry does **not** roll back `Vehicle.mileage`. The odometer reading recorded at service time is a historical fact even if the entry is removed.
- `LogItem` and `LogMedia` rows are removed via Prisma `onDelete: Cascade` on the FK.

### Error responses

| Status | Body | When |
|---|---|---|
| 401 | `{ "error": "..." }` | No/invalid/expired bearer token |
| 403 | `{ "error": "Forbidden" }` | Vehicle belongs to another account |
| 404 | `{ "error": "Vehicle not found" }` | Vehicle ID does not exist |
| 404 | `{ "error": "Log entry not found" }` | Entry does not exist |
| 500 | `{ "error": "Internal server error" }` | Unexpected failure |

---

## Acceptance Criteria

### POST

- [ ] Valid request creates a Log Entry with all provided fields and returns 201
- [ ] Items array creates `LogItem` rows; empty or omitted items array creates no rows
- [ ] Media array creates `LogMedia` rows; empty or omitted media array creates no rows
- [ ] `item.totalCost` is `quantity * unitCost`; null when either is absent
- [ ] `logEntry.totalCost` is the sum of all item totals; null when no items have costs
- [ ] Mileage higher than vehicle mileage updates `vehicle.mileage`
- [ ] Mileage equal to or lower than vehicle mileage does not update `vehicle.mileage`
- [ ] Unknown `typeId` returns 400
- [ ] Unknown `items[].categoryId` returns 400
- [ ] Missing required fields (`typeId`, `title`, `date`) return 400
- [ ] Invalid `time` format returns 400
- [ ] Returns 403 for wrong account; 404 for missing vehicle
- [ ] Unit test: happy path with items and media
- [ ] Unit test: minimal (type + title + date only)
- [ ] Unit test: mileage auto-update (higher)
- [ ] Unit test: mileage no-update (lower)
- [ ] Unit test: unknown typeId → 400
- [ ] Unit test: 403 and 404

### GET list

- [ ] Returns all entries for the vehicle sorted by date descending
- [ ] `typeId` query param filters to matching entries only
- [ ] Unknown `typeId` query param returns 400
- [ ] Empty list returns `{ logEntries: [] }` with 200
- [ ] Unit test: populated list
- [ ] Unit test: empty list
- [ ] Unit test: typeId filter
- [ ] Unit test: 403 and 404

### GET single

- [ ] Returns full entry with items and media arrays
- [ ] 404 when entry does not exist or belongs to a different vehicle
- [ ] Unit test: happy path
- [ ] Unit test: 404

### PATCH

- [ ] Partial scalar update only updates provided fields; omitted fields are unchanged
- [ ] Providing `items` array replaces all existing items
- [ ] Providing `media` array replaces all existing media refs
- [ ] Mileage auto-update applies on PATCH if new mileage is higher
- [ ] 404 when entry not found
- [ ] Unit test: partial scalar update
- [ ] Unit test: items replacement (including empty array clearing all items)
- [ ] Unit test: 403 and 404

### DELETE

- [ ] Deletes entry and cascades to items and media rows; returns 204
- [ ] Does not modify vehicle mileage
- [ ] Returns 404 when entry not found
- [ ] Unit test: happy path
- [ ] Unit test: 404

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Items and media as full replacement on PATCH | Send complete arrays; service deletes old rows and inserts new | Avoids a per-item CRUD sub-API in V1; entry item counts are small enough that full replacement is negligible, and it keeps the client logic simple (no tracking of item IDs for differential updates) |
| typeId and categoryId validated against DB | Service or repository verifies the ID exists in the lookup table | Ensures referential integrity beyond the FK constraint; returns a clear 400 with the offending field rather than a 500 from a constraint violation |
| Mileage auto-update is conditional SQL | `UPDATE vehicles SET mileage = ? WHERE id = ? AND mileage < ?` | Atomic at the database level — no read-then-write race; correct no-op when another write raced ahead |
| DELETE does not decrement mileage | Vehicle mileage is never rolled back | Mileage recorded at a service event is a historical fact; removing the log entry does not undo the physical distance travelled |

---

## Out of scope

- Pagination of the log entry list (V2 — client-side filtering is sufficient in V1)
- Bulk delete of log entries
- `GET /log-entry-types` and `GET /item-categories` endpoints (separate small spec — needed by the frontend type picker)
