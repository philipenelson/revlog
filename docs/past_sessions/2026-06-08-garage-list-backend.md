# Session: Garage list backend implementation

**Date:** 2026-06-08
**Branch/worktree:** `worktree-garage-backend`

---

## Goal

A separate agent was building the Garage screen UI (`docs/designs/revlog-garage-preview.html`) in parallel, in its own `garage-screen` worktree. This session built the backend it needs: a `GET /vehicles` endpoint returning the authenticated Owner's vehicle list (and empty-state signal) for that screen.

This continues directly from [`vehicle-creation-api.md`](../specs/garage/vehicle-creation-api.md), whose "Out of scope" section explicitly deferred `GET /vehicles` to "separate Garage/Vehicle screen specs."

## Key design problem: the design references data that doesn't exist yet

The Garage design shows a "Log entries" stat per vehicle and a page subtitle reading "Sorted by most recently logged" — but the `LogEntry` model is its own unstarted V1 feature (`docs/milestones/v1.md` — Log Entry is `[ ]`). There is no table to count against and no timestamp to sort by directly.

Resolved both honestly rather than faking data:

- **`logEntryCount` is a hardcoded `0`** for every vehicle in the response. This is *literally true* today — zero log entries exist anywhere in the system — not a stub pretending to be real data. The design's own `is-empty` stat-block style already renders this as "No entries yet," so the UI needs no special-casing. Becomes a real `COUNT(*) ... GROUP BY vehicleId` aggregate, additive and non-breaking, once `LogEntry` ships.
- **Sort order uses `Vehicle.updatedAt DESC`** as the proxy for "most recently logged." It already reflects creation and edits, and is the natural column for a future log-entry write to also bump (e.g. updating `mileage`) — a connection the eventual Log Entry spec will need to make explicit. Until then, "most recently logged" effectively reads as "most recently touched."

Both are called out in the spec's Decisions table *and* its Out of scope section, specifically so the Log Entry feature's spec knows to circle back and upgrade them.

## Other decisions

- **No pagination** — a personal garage is realistically a handful of vehicles; cursors/page-size validation would be complexity with no real list large enough to need it.
- **Empty garage is `200 { vehicles: [] }`, not `404`** — an Owner with zero vehicles (e.g. skipped onboarding) is a normal, designed-for state (the empty state in the preview HTML), not an error condition the client has to special-case.
- **Response wrapped as `{ vehicles: [...] }`** — consistent with the `{ vehicle: {...} }` convention `POST /vehicles` already established.
- **Account scoping from the verified access-token payload**, never a query parameter — same rule `POST /vehicles` follows; an Owner can only ever see their own garage.

## What was built (2 sequential commits, doc-first)

1. `069c9e1` — **Spec**: `docs/specs/garage/garage-list-api.md` (use cases UC-GARAGE-1/2, acceptance criteria, decisions, out of scope), linked from `v1.md` Garage section
2. `4326ecb` — **API**:
   - `IVehicleRepository.findAllByAccountId` (domain interface) + `PrismaVehicleRepository` implementation, `ORDER BY updatedAt DESC`
   - `VehicleService.listVehicles(accountId)`
   - Authenticated `GET /vehicles` route → `{ vehicles: [{ id, nickname, make, model, year, mileage, logEntryCount }] }`
   - Vitest coverage for both layers: auth guards (401), account scoping, empty-garage case, error forwarding (7 new tests)

## Verification performed

- `pnpm --filter @maintenance-log/api test` → 71/71 passing (was 64; +7 new)
- `npx tsc --noEmit` (apps/api) → clean

No live smoke test against the dev server this session — the change is read-only and fully covered by the existing auth/error-middleware test infrastructure already exercised in the prior onboarding-backend session.

## Explicitly out of scope (tracked for later)

- `GET /vehicles/:id`, `PATCH /vehicles/:id`, `DELETE /vehicles/:id` — Vehicle detail/edit screen, separate spec
- Real `logEntryCount` aggregation and true "most recently logged" sorting — blocked on the `LogEntry` model
- Search/filter/sort controls, pagination — no V1 use case needs them at expected garage sizes
- Vehicle photos/thumbnails — V2
