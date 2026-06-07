# Garage List API Spec

**Area:** Garage
**Status:** In progress
**Last updated:** 2026-06-07

---

## Overview

Backend implementation of `GET /vehicles` — the endpoint the Garage screen (`docs/designs/revlog-garage-preview.html`, screen spec to follow from the team building that UI) reads to render an Owner's vehicle list, including its empty state.

This is a read-only continuation of the [vehicle-creation-api.md](./vehicle-creation-api.md) spec, which explicitly deferred `GET /vehicles` to "separate Garage/Vehicle screen specs." It reuses that spec's authentication, account-scoping, and response-shape conventions, and the `DomainVehicle` types already in `@maintenance-log/domain`.

The route requires authentication via the existing `authenticate` middleware (`apps/api/src/middleware/auth.ts`).

---

## Use cases

### UC-GARAGE-1 — View a populated garage

**Who:** An authenticated Owner with one or more Vehicles in their Account
**Precondition:** The Owner has previously created at least one Vehicle (via onboarding or the Add Vehicle screen)
**What happens:**
1. The Owner navigates to the Garage screen
2. The client calls `GET /vehicles` with its access token
3. The system returns every Vehicle scoped to the Owner's Account, ordered by most-recently-logged (see Decisions — "Sort order proxy"), each with its display stats (odometer reading, log entry count)
4. The client renders one card per Vehicle plus an "Add a vehicle" tile

### UC-GARAGE-2 — View an empty garage

**Who:** An authenticated Owner with zero Vehicles (e.g. skipped onboarding)
**Precondition:** The Owner's Account has no Vehicle rows
**What happens:**
1. The Owner navigates to the Garage screen
2. The client calls `GET /vehicles` with its access token
3. The system returns an empty list
4. The client renders the empty state ("Your garage is empty" + "Add your first vehicle" CTA) instead of the grid

---

## GET /vehicles

### Request

```
GET /vehicles
Authorization: Bearer <accessToken>
```

No query parameters, no request body.

### Responses

| Status | Body | When |
|---|---|---|
| 200 | `{ "vehicles": [{ "id": "...", "nickname": "...\|null", "make": "...", "model": "...", "year": 2021, "mileage": 14230, "logEntryCount": 0 }] }` | Always, on a valid request — `vehicles` is `[]` for an empty garage (this *is* the empty-state signal; see UC-GARAGE-2) |
| 401 | `{ "error": "Missing or invalid authorization header" }` / `{ "error": "Invalid or expired access token" }` | No/invalid/expired bearer token (from `authenticate` middleware) |
| 500 | `{ "error": "Internal server error" }` | Unexpected failure |

### Side effects

None — this is a read-only query. It does not touch `Account.status`; onboarding resolution remains exclusively the concern of `POST /vehicles` and `POST /onboarding/skip` (see [ADR 0015](../../adr/0015-account-status-state-machine.md)).

---

## Acceptance Criteria

- [ ] `GET /vehicles` with a valid bearer token returns 200 and every Vehicle scoped to the caller's Account — never another Account's Vehicles
- [ ] `GET /vehicles` for an Account with no Vehicles returns 200 `{ vehicles: [] }` (not a 404 — an empty garage is a valid, expected state, not an error)
- [ ] `GET /vehicles` orders results by `updatedAt` descending (most-recently-touched Vehicle first — see Decisions — "Sort order proxy")
- [ ] `GET /vehicles` with no/invalid/expired bearer token returns 401 and performs no query
- [ ] Each Vehicle in the response includes `logEntryCount: 0` (see Decisions — "`logEntryCount` is a hardcoded placeholder")
- [ ] Response payload matches the stat blocks the Garage screen design renders per card (nickname/make/model/year, odometer reading with its unit, log entry count or "No entries yet")

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Endpoint shape | `GET /vehicles` returns *all* of the caller's Vehicles in one response, no pagination | A personal garage is small by nature — realistically a handful of vehicles, not hundreds. Pagination would add complexity (cursors, page-size validation, a different response envelope) with no real-world list large enough to need it. Revisit only if usage data ever shows otherwise |
| Account scoping | `accountId` taken from the verified access-token payload (`req.auth!.accountId`), never a query parameter | Same rule as `POST /vehicles` in [vehicle-creation-api.md](./vehicle-creation-api.md) — an Owner can only ever see their own Garage; there is no path to list another Account's Vehicles |
| Empty garage is `200 { vehicles: [] }`, not `404` | Plain empty array | An Owner with no Vehicles (e.g. skipped onboarding) is a normal, expected state with its own designed UI (the empty state in `revlog-garage-preview.html`) — not an error condition. A `404` would force the client to special-case "no vehicles" vs. "request failed," which the response shape already disambiguates for free |
| Response shape | `{ vehicles: [...] }` (wrapped, array under a named key) | Consistent with the `{ vehicle: {...} }` wrapping convention `POST /vehicles` already established, and leaves room to add sibling keys (e.g. pagination metadata, account summary) later without a breaking shape change |
| **Sort order proxy: `updatedAt` descending stands in for "most recently logged"** | `ORDER BY updatedAt DESC` | The Garage design's subtitle reads "Sorted by most recently logged" — but `LogEntry` does not exist yet (see [v1 milestone](../../milestones/v1.md) — Log Entry is `[ ]` not started), so there is no timestamp to sort by directly. `Vehicle.updatedAt` is the closest available proxy: it already reflects vehicle creation and any edit, and is the natural column to also move once logging a maintenance entry updates its Vehicle (e.g. bumping `mileage`) — a connection the Log Entry feature's own spec will need to make explicit. Until then, "most recently logged" effectively reads as "most recently touched," which is a reasonable, honest approximation rather than a fabricated signal |
| **`logEntryCount` is a hardcoded placeholder (`0`) until `LogEntry` exists** | Every Vehicle's `logEntryCount` is `0` | There is no `LogEntry` table to `COUNT` against — returning `0` for every Vehicle is the *literally true* answer today (zero log entries exist anywhere in the system), not a stub masquerading as data. The Garage design already renders empty counts via its `is-empty` stat-block style ("No entries yet"), so the UI requires no special-casing. When the Log Entry feature ships, this becomes a real `COUNT(*) ... GROUP BY vehicleId` aggregate added to the repository — an additive, non-breaking change to this same response shape |
| No `GET /vehicles/:id` in this spec | Out of scope here | The Garage screen only needs the list; Vehicle detail is its own screen and its own spec (see Out of scope) |

---

## Out of scope

- `GET /vehicles/:id` (Vehicle detail), `PATCH /vehicles/:id` (edit), `DELETE /vehicles/:id` — separate Vehicle screen spec (see `docs/milestones/v1.md` — Vehicle); also still listed as out of scope on [vehicle-creation-api.md](./vehicle-creation-api.md)
- Real `logEntryCount` aggregation and true "most recently logged" sorting — both depend on the `LogEntry` model, which is its own unstarted V1 feature (see `docs/milestones/v1.md` — Log Entry). Tracked here so the Log Entry spec knows to circle back and upgrade both
- Search, filtering, sorting controls, or pagination on the Garage list — no V1 use case calls for them at expected garage sizes
- Vehicle photos / thumbnails in the list response (V2 — see `docs/milestones/v2.md`)
