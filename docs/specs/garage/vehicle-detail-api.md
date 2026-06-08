# Vehicle Detail API Spec

**Area:** Garage
**Status:** Not started
**Last updated:** 2026-06-09

---

## Overview

Backend implementation of `GET /vehicles/:vehicleId` — the endpoint the Vehicle Detail screen fetches on mount. Returns the full Vehicle record with associated insurance, a summary list of Log Entries, and computed stats (total spent, last logged date).

Authentication is required via the existing `authenticate` middleware. The Vehicle must belong to the authenticated User's Account; requests for other accounts' Vehicles return 403.

---

## GET /vehicles/:vehicleId

### Request

```
GET /vehicles/:vehicleId
Authorization: Bearer <accessToken>
```

### Path parameters

| Parameter | Type | Rules |
|---|---|---|
| `vehicleId` | string (UUID) | Required; must be a valid UUID format |

### Response — 200 OK

```json
{
  "vehicle": {
    "id": "uuid",
    "nickname": "Blackbird | null",
    "make": "Honda",
    "model": "CB650R",
    "year": 2019,
    "mileage": 12400,
    "photoUrl": "/uploads/vehicles/abc123.jpg | null",
    "insurance": {
      "company": "Progressive | null",
      "policyNumber": "MX-1234567 | null",
      "startDate": "2025-06-01 | null",
      "expiryDate": "2026-06-01 | null",
      "premium": "620.00 | null",
      "premiumPeriod": "ANNUAL | null",
      "towNumber": "1-800-776-2778 | null",
      "notes": "Comprehensive + theft | null"
    },
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
    ],
    "stats": {
      "totalSpent": "1840.00",
      "lastLoggedAt": "2025-06-03 | null"
    }
  }
}
```

`insurance` is `null` when no record exists for the Vehicle.
`logEntries` is an empty array when none exist, sorted by `date` descending.
`totalCost` on each entry is the sum of `quantity * unitCost` across all items for that entry; `null` if no items have a cost.
`stats.lastLoggedAt` is `null` when `logEntries` is empty.

### Error responses

| Status | Body | When |
|---|---|---|
| 401 | `{ "error": "Missing or invalid authorization header" }` / `{ "error": "Invalid or expired access token" }` | No/invalid/expired bearer token |
| 403 | `{ "error": "Forbidden" }` | Vehicle exists but does not belong to the caller's Account |
| 404 | `{ "error": "Vehicle not found" }` | No Vehicle with this ID exists |
| 500 | `{ "error": "Internal server error" }` | Unexpected failure |

### Three-layer responsibilities

**Route** (`apps/api/src/routes/vehicles.ts`):
- Validates `vehicleId` path param is a non-empty string
- Calls `vehicleService.getDetail(vehicleId, accountId)`
- Returns 200 with payload, or delegates errors to the global error middleware via `next(err)`

**Service** (`apps/api/src/services/VehicleService.ts`):
- Calls `vehicleRepo.findDetailById(vehicleId)`
- If no vehicle found → throws `AppError` (404)
- If vehicle's `accountId` does not match the caller's `accountId` (from token) → throws `AppError` (403)
- Computes `stats.totalSpent` and `stats.lastLoggedAt` from the returned log entries
- Returns the assembled payload

**Repository** (`apps/api/src/repositories/VehicleRepository.ts`):
- `findDetailById(vehicleId)` — a single Prisma query with:
  ```
  include: {
    insurance: true,
    logEntries: {
      include: { items: true, _count: { select: { media: true } } },
      orderBy: { date: 'desc' }
    }
  }
  ```
- Returns a domain-shaped object; never exposes raw Prisma model types outside the repository layer
- Does **not** include `logEntries.items` nested arrays on each entry in the summary — returns `_count` for itemCount and aggregates cost in the service or via a raw select

---

## Acceptance Criteria

- [ ] `GET /vehicles/:vehicleId` with a valid token and matching accountId returns 200 with full vehicle payload
- [ ] Response includes `insurance: null` when no insurance record exists
- [ ] Response includes `logEntries: []` and `stats.lastLoggedAt: null` when no entries exist
- [ ] `logEntries` are sorted by `date` descending
- [ ] `totalCost` on each log entry summary is the sum of `quantity * unitCost` for that entry's items (null when no items have costs)
- [ ] `stats.totalSpent` is the sum of all entry `totalCost` values (formatted as decimal string)
- [ ] Vehicle belonging to a different Account returns 403
- [ ] Non-existent Vehicle ID returns 404
- [ ] Missing or invalid bearer token returns 401
- [ ] Unit test: happy path — vehicle with insurance, multiple entries, costs
- [ ] Unit test: vehicle with no insurance record
- [ ] Unit test: vehicle with no log entries
- [ ] Unit test: 403 when accountId does not match
- [ ] Unit test: 404 when vehicle not found

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Log entry list as summary (not full items) | Return `itemCount`, `mediaCount`, `totalCost` per entry rather than full nested items | The Vehicle Detail screen needs only summary data for the history list; full items are fetched per-entry when the Owner opens a specific Log Entry |
| Stats computed in service layer | `totalSpent` and `lastLoggedAt` computed in `VehicleService` from the repository result | Keeps the repository simple (no raw SQL aggregates); stats computation is straightforward and entry counts are small in V1 |
| 403 vs 404 distinction | Return 403 when the vehicle exists but belongs to another account, 404 when it does not exist | Avoids leaking the existence of other accounts' vehicles — the caller should not be able to distinguish "your vehicle" from "no vehicle" without authorization |

---

## Out of scope

- `PATCH /vehicles/:vehicleId` (edit vehicle — separate spec)
- Pagination of the log entry list (V2 — client-side filtering is sufficient in V1)
- Server-side log entry type filtering (V2)
