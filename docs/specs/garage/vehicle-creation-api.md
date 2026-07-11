# Vehicle Creation API Spec

**Area:** Garage  
**Status:** Implemented  
**Last updated:** 2026-06-07

---

## Overview

Backend implementation of vehicle creation — `POST /vehicles`. This is the endpoint the [onboarding wizard](../onboarding/onboarding-wizard.md) Step 2 submits to (see that spec's "Next steps — Wire Step 2 to the real Vehicle creation endpoint"), and is also the foundation for the future Add Vehicle screen reachable from the Garage (see `docs/milestones/v1.md` — Vehicle).

Validation uses a Zod schema (`createVehicleSchema`) from `@maintenance-log/contracts` (see [ADR 0010](../../adr/0010-zod-validation.md)). The route requires authentication via the existing `authenticate` middleware (`apps/api/src/middleware/auth.ts`) — this is its first real usage in the codebase.

Creating a Vehicle also resolves onboarding for the owning Account — see "Side effects" below and [ADR 0015](../../adr/0015-account-status-state-machine.md).

---

## POST /vehicles

### Request

```
POST /vehicles
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "nickname": "string — optional, max 100 characters",
  "make": "string — required, max 100 characters",
  "model": "string — required, max 100 characters",
  "year": "number — integer, 1900–(current year + 1)",
  "mileage": "number — integer, 0–2,000,000"
}
```

### Input sanitization

Applied by Zod transforms in `createVehicleSchema` before the service receives any data, per the root `CLAUDE.md` Input handling rules:

| Field | Transform |
|---|---|
| `nickname` | Trim whitespace; empty string after trim → `null` (stored as "no nickname", matching the wizard's "Nickname (optional)" field and the spec plate's `—` placeholder) |
| `make`, `model` | Trim whitespace — required, non-empty after trimming |
| `year`, `mileage` | Coerced to integer; range-checked (see Field rules) |

### Field rules

- **Nickname** — optional; the only optional field (matches [onboarding-wizard.md Acceptance Criteria — Step 2](../onboarding/onboarding-wizard.md))
- **Make / Model** — required, free text in this iteration (see Decisions — "Make/Model stored as free text")
- **Year** — required, integer between 1900 and the current year + 1 (allows next-model-year vehicles sold ahead of the calendar year, a common motorcycle industry practice; rejects obviously-invalid values like `0` or `99999`)
- **Mileage** — required, integer between 0 and 2,000,000 (a generous ceiling — no production motorcycle accumulates anywhere near this; it exists purely to reject garbage input, not to model a realistic maximum)

### Responses

| Status | Body | When |
|---|---|---|
| 201 | `{ "vehicle": { "id": "...", "nickname": "...\|null", "make": "...", "model": "...", "year": 2021, "mileage": 14230 } }` | Vehicle created |
| 400 | `{ "error": "Invalid input", "details": [...] }` | Zod validation failure |
| 401 | `{ "error": "Missing or invalid authorization header" }` / `{ "error": "Invalid or expired access token" }` | No/invalid/expired bearer token (from `authenticate` middleware) |
| 500 | `{ "error": "Internal server error" }` | Unexpected failure |

### Side effects

1. Create `Vehicle` row, linked to the authenticated User's `accountId` (from the access token payload — never from the request body; an Owner can only ever create Vehicles in their own Garage)
2. **Resolve onboarding:** conditionally transition the owning `Account.status` from `ONBOARDING` to `ACTIVE` (`UPDATE account SET status = 'ACTIVE' WHERE id = ? AND status = 'ONBOARDING'`) — a no-op if the Account is already `ACTIVE`. See [ADR 0015](../../adr/0015-account-status-state-machine.md) and "Decisions — Account-status transition is non-transactional" below.

---

## Acceptance Criteria

- [x] `POST /vehicles` with a valid body and valid bearer token creates one `Vehicle` row scoped to the caller's Account
- [x] `POST /vehicles` with a valid body while the Account is `ONBOARDING` transitions it to `ACTIVE`
- [x] `POST /vehicles` with a valid body while the Account is already `ACTIVE` leaves it `ACTIVE` (idempotent)
- [x] `POST /vehicles` with an empty/missing `make`, `model`, non-numeric `year`, or non-numeric `mileage` returns 400 with Zod details and does not create a row
- [x] `POST /vehicles` with no/invalid/expired bearer token returns 401 and does not create a row
- [x] `POST /vehicles` with an omitted or blank `nickname` stores `null`
- [x] Response payload matches the "spec plate" data set the onboarding wizard's Step 3 already renders (Nickname, Make, Model, Year, Mileage)

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Authentication | Required (`authenticate` middleware, Bearer JWT) | A Vehicle always belongs to an Account; there is no anonymous creation path |
| Account scoping | `accountId` taken from the verified access-token payload, never the request body | Prevents an Owner from creating Vehicles in another Account's Garage by forging the field |
| Account-status transition is non-transactional | `vehicleRepo.create` and `accountRepo.markActive` run as two sequential repository calls, not inside a Prisma `$transaction` (unlike `userRepo.createWithAccount`, which is transactional "by design — registration is inherently atomic") | The two writes are independently idempotent and self-healing: `markActive`'s conditional `WHERE status = 'ONBOARDING'` means a crash between the two calls just leaves the next Vehicle-creation or skip call to complete the transition. Momentary inconsistency (Vehicle exists, Account still shows `ONBOARDING`) is harmless — it resolves itself on the very next write, and is never user-visible as an error. Forcing a cross-entity transaction here would couple the Vehicle and Account repositories the way `createWithAccount` couples User and Account, without registration's "cannot leave an orphan" requirement to justify it |
| `markActive` is a conditional `updateMany`, not read-then-write | `UPDATE account SET status = 'ACTIVE' WHERE id = ? AND status = 'ONBOARDING'` | Atomic at the database level — no race between reading the current status and writing the new one; correctly idempotent (no-op when already `ACTIVE`); stays within the repository layer's "query filters, not decisions" boundary (the service decides *to call* `markActive`; the repository just performs a guarded write) |
| **Make/Model stored as free text (`String` columns)** | Plain text now; structured `Make`/`Model` reference tables deferred | See below — this is intentional, documented technical debt, not an oversight |
| Year range | 1900–(current year + 1) | Lower bound excludes pre-automotive-era garbage; the `+1` allows next-model-year vehicles, which motorcycle manufacturers commonly sell ahead of the calendar year |
| Mileage range | 0–2,000,000 | A ceiling that exists only to catch obviously-garbage input (e.g. accidental extra digits) — not an attempt to model a realistic maximum |
| Response shape | `{ vehicle: {...} }` (wrapped) | Consistent with the wrapped style the codebase uses elsewhere for entity payloads, and leaves room to add sibling keys (e.g. `account`) later without a breaking shape change |

### Make/Model stored as free text — known debt and migration path

The onboarding spec's wizard Step 2 ships Make and Model as free-text inputs, and explicitly tracks "Build a reference dataset of vehicle makes, models, and years" as its own separate V1 feature requiring its own spec + ADR — because the relational shape of that dataset (`Make → Model → Year`, vs. `Year → Make → Model`, vs. a displacement-inclusive `CC → Year → Make → Model`) "depends entirely on what the chosen data source provides," and no data source has been chosen yet.

We considered building the structured model first to avoid a future data migration, and rejected it: doing so *now*, without a data source, risks guessing the wrong relational shape and redoing the work anyway — the exact rework this would be trying to avoid. Free text now and a deliberate, scoped migration later is the smaller and more predictable total cost. The migration path is sketched concretely so it isn't a surprise when the dataset lands:

1. Seed `Make` / `Model` reference tables once a data source and shape are chosen (separate spec + ADR, per the onboarding spec's Next steps)
2. Add nullable `makeId` / `modelId` foreign-key columns to `Vehicle` — additive, non-breaking migration; existing rows are untouched
3. Run a one-time backfill script: normalize and fuzzy-match each existing `Vehicle.make` / `model` string against the new reference tables (exact case-insensitive match first, then a similarity threshold); auto-link confident matches; flag low-confidence/no-match rows for manual review
4. Once backfilled and reviewed, make the FK columns required, and either retire the free-text columns or keep them as a denormalized display cache (decide at that time, based on how the Garage/Vehicle screens end up reading this data)

This migration is tracked in `docs/milestones/v1.md` directly under the reference-dataset item — see "Updates to existing specs" cross-references below.

---

## Out of scope

- Make/Model/Year structured reference dataset and selection UI (separate spec + ADR — see [onboarding-wizard.md Next steps](../onboarding/onboarding-wizard.md#build-a-reference-dataset-of-vehicle-makes-models-and-years))
- `GET /vehicles` (Garage list), `GET /vehicles/:id` (Vehicle detail), `PATCH /vehicles/:id` (edit), `DELETE /vehicles/:id` — separate Garage/Vehicle screen specs (see `docs/milestones/v1.md` — Garage, Vehicle)
- Photo upload (V2 — see `docs/milestones/v2.md`)
- VIN, purchase date — not V1 Vehicle concepts (see [onboarding-wizard.md Decisions](../onboarding/onboarding-wizard.md))
