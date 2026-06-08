# Vehicle Insurance API Spec

**Area:** Garage
**Status:** Not started
**Last updated:** 2026-06-09

---

## Overview

Backend implementation of the three insurance endpoints: `GET`, `PUT`, and `DELETE` for `/vehicles/:vehicleId/insurance`. The Insurance dialog on the Vehicle Detail screen drives all three.

All insurance fields are optional — an Owner can store as little or as much information as they wish. The PUT endpoint is an upsert: it creates the record if none exists and replaces it if one does.

Authentication and Vehicle ownership checks follow the same pattern as other Vehicle-scoped endpoints — the Vehicle must belong to the authenticated User's Account.

---

## GET /vehicles/:vehicleId/insurance

### Request

```
GET /vehicles/:vehicleId/insurance
Authorization: Bearer <accessToken>
```

### Response — 200 OK

```json
{
  "insurance": {
    "company": "Progressive | null",
    "policyNumber": "MX-1234567 | null",
    "startDate": "2025-06-01 | null",
    "expiryDate": "2026-06-01 | null",
    "premium": "620.00 | null",
    "premiumPeriod": "ANNUAL | null",
    "towNumber": "1-800-776-2778 | null",
    "notes": "Comprehensive + theft | null"
  }
}
```

### Error responses

| Status | Body | When |
|---|---|---|
| 401 | `{ "error": "..." }` | No/invalid/expired bearer token |
| 403 | `{ "error": "Forbidden" }` | Vehicle exists but does not belong to caller's Account |
| 404 | `{ "error": "Vehicle not found" }` | Vehicle ID does not exist |
| 404 | `{ "error": "No insurance on file" }` | Vehicle exists but has no insurance record |
| 500 | `{ "error": "Internal server error" }` | Unexpected failure |

---

## PUT /vehicles/:vehicleId/insurance

Upsert — creates the record if none exists; replaces it if one does.

### Request

```
PUT /vehicles/:vehicleId/insurance
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "company": "string — optional, max 200 characters",
  "policyNumber": "string — optional, max 100 characters",
  "startDate": "ISO 8601 date string — optional",
  "expiryDate": "ISO 8601 date string — optional",
  "premium": "number — optional, decimal ≥ 0",
  "premiumPeriod": "MONTHLY | QUARTERLY | BIANNUAL | ANNUAL — optional",
  "towNumber": "string — optional, max 50 characters",
  "notes": "string — optional, max 2000 characters"
}
```

An empty body `{}` is valid and stores/replaces the record with all-null fields.

### Input sanitization

Applied via Zod transforms in `upsertInsuranceSchema` (`packages/domain/src/schemas/`):

| Field | Transform |
|---|---|
| `company` | Trim whitespace; empty string after trim → `null` |
| `policyNumber` | Trim whitespace; empty string after trim → `null` |
| `towNumber` | Trim whitespace; empty string after trim → `null` |
| `notes` | Trim whitespace; empty string after trim → `null` |
| `startDate`, `expiryDate` | Parsed as ISO 8601 date; invalid format → 400 |
| `premium` | Coerced to decimal; negative value → 400 |

### Response — 200 OK

```json
{
  "insurance": {
    "company": "Progressive | null",
    "policyNumber": "MX-1234567 | null",
    "startDate": "2025-06-01 | null",
    "expiryDate": "2026-06-01 | null",
    "premium": "620.00 | null",
    "premiumPeriod": "ANNUAL | null",
    "towNumber": "1-800-776-2778 | null",
    "notes": "Comprehensive + theft | null"
  }
}
```

### Error responses

| Status | Body | When |
|---|---|---|
| 400 | `{ "error": "Invalid input", "details": [...] }` | Zod validation failure |
| 401 | `{ "error": "..." }` | No/invalid/expired bearer token |
| 403 | `{ "error": "Forbidden" }` | Vehicle does not belong to caller's Account |
| 404 | `{ "error": "Vehicle not found" }` | Vehicle ID does not exist |
| 500 | `{ "error": "Internal server error" }` | Unexpected failure |

### Three-layer responsibilities

**Route:** validates `vehicleId`, parses and validates body against `upsertInsuranceSchema`, calls service, returns 200.

**Service:** verifies Vehicle ownership (403 / 404); calls `insuranceRepo.upsert(vehicleId, data)`.

**Repository:** `upsert` — Prisma `upsert` with `where: { vehicleId }`, `create: { vehicleId, ...data }`, `update: { ...data }`. Returns domain-shaped insurance object.

---

## DELETE /vehicles/:vehicleId/insurance

### Request

```
DELETE /vehicles/:vehicleId/insurance
Authorization: Bearer <accessToken>
```

### Response — 204 No Content

Empty body.

### Error responses

| Status | Body | When |
|---|---|---|
| 401 | `{ "error": "..." }` | No/invalid/expired bearer token |
| 403 | `{ "error": "Forbidden" }` | Vehicle does not belong to caller's Account |
| 404 | `{ "error": "Vehicle not found" }` | Vehicle ID does not exist |
| 404 | `{ "error": "No insurance on file" }` | No insurance record to delete |
| 500 | `{ "error": "Internal server error" }` | Unexpected failure |

---

## Acceptance Criteria

### GET

- [ ] Returns 200 with insurance record when one exists
- [ ] Returns 404 "No insurance on file" when vehicle exists but has no insurance record
- [ ] Returns 403 when vehicle belongs to another account
- [ ] Returns 404 "Vehicle not found" when vehicle ID does not exist
- [ ] Returns 401 for missing/invalid token
- [ ] Unit test: happy path (record exists)
- [ ] Unit test: no record (404)
- [ ] Unit test: 403 ownership check
- [ ] Unit test: 404 vehicle not found

### PUT

- [ ] Creates a new record when none exists; returns 200 with the created data
- [ ] Replaces the existing record when one exists; returns 200 with updated data
- [ ] An empty body `{}` creates/replaces the record with all-null fields
- [ ] Text fields are trimmed; empty-after-trim strings are stored as null
- [ ] Invalid date strings return 400
- [ ] Negative premium returns 400
- [ ] Strings exceeding max length return 400
- [ ] Returns 403 when vehicle belongs to another account
- [ ] Returns 404 when vehicle not found
- [ ] Returns 401 for missing/invalid token
- [ ] Unit test: create (no prior record)
- [ ] Unit test: replace (prior record exists)
- [ ] Unit test: empty body upsert
- [ ] Unit test: 400 for invalid date
- [ ] Unit test: 403 and 404

### DELETE

- [ ] Removes the insurance record; returns 204
- [ ] Returns 404 when no record exists
- [ ] Returns 403 when vehicle belongs to another account
- [ ] Returns 404 when vehicle not found
- [ ] Returns 401 for missing/invalid token
- [ ] Unit test: happy path
- [ ] Unit test: no record to delete (404)
- [ ] Unit test: 403 and 404 vehicle

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| PUT as upsert (not POST + PATCH) | A single `PUT /insurance` endpoint creates or replaces | Insurance is a 1:1 record per Vehicle; separating creation from update adds no semantic benefit and complicates the client (no need to know whether a record exists before deciding which method to use) |
| All fields optional | No required fields on the insurance record | Owners should be able to store partial information — a policy number without dates, or just an expiry reminder with no other details |
| Empty body is valid | `PUT {}` stores/replaces all-null fields | Allows the client to "reset" insurance to a blank record without calling DELETE |
| `premiumPeriod` enum | `MONTHLY`, `QUARTERLY`, `BIANNUAL`, `ANNUAL` stored in DB | Covers the four common billing cycles without over-engineering; V2 can add more if needed |

---

## Out of scope

- Insurance history / multiple policies per Vehicle (V2 — only one active policy in V1)
- Expiry reminder notifications (V2 — the front end computes the 30-day warning from the stored date)
- Integration with insurance provider APIs (post-V2 concept)
