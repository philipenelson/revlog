# Session: Garage log entry count fix + pre-ship audit

**Date:** 2026-07-03
**Branch:** `main` (in-place — no worktree for this session)

---

## Goal

User reported a bug: "number of entries in the garage screen is not working. It always displays 0." Investigation traced this to `GET /vehicles` on the API returning a hardcoded `logEntryCount: 0` placeholder in the route handler — a leftover from before the `LogEntry` model existed. Mobile's sync plumbing (`VehicleRepository.reconcile()`) already passed through whatever the server sent, so no mobile changes were needed once the server returned a real value.

Separately, once the fix was in, the user raised a broader concern: past sessions had produced "a lot of shit work" requiring manual refactoring, and that decisions (not just tiny implementation mechanics) need to be surfaced to them before being implemented, not left for them to catch in review later. A four-way parallel audit (mobile architecture, API architecture, docs-vs-code drift, and doc quality on its own merits) was run to produce a concrete backlog for the user's own pre-ship refactor pass.

---

## Key decisions

**`logEntryCount` typed as an inline intersection, not a new named interface.** A first pass added a `DomainVehicleListItem extends DomainVehicle` interface to `packages/domain/src/vehicle/index.ts`. The user rejected this, both questioning the extra interface and the `DomainVehicle` naming itself, and asked for `VehicleType & { logEntryCount: number }` instead. Settled via `IVehicleRepository.findAllByAccountId(): Promise<(DomainVehicle & { logEntryCount: number })[]>` — an inline intersection, no new named type. The `Domain[Entity]` naming convention itself was left untouched (out of scope for this fix) but flagged as disliked feedback for a future rename pass.

**Response mapping stays in the routes file.** `toVehicleListItemResponse` (which merges `logEntryCount` into the HTTP response shape) stays in `apps/api/src/routes/vehicles.ts` rather than moving into the service layer, per `apps/api/CLAUDE.md`: routes map domain results to HTTP responses, services must stay decoupled from `req`/`res`, and this mapper needs `req.protocol`/`req.get('host')` (via `buildPhotoUrl`) which only the route layer has access to.

**Real aggregate via Prisma `_count`, no schema change.** `VehicleRepository.findAllByAccountId` now uses `include: { _count: { select: { logEntries: true } } }` and maps `_count.logEntries` onto each returned vehicle — additive to the existing response shape, no migration needed.

---

## What was built

| Commit | Description |
|---|---|
| _(this commit)_ | `VehicleRepository.findAllByAccountId` returns a real `logEntryCount` via Prisma `_count`; `IVehicleRepository`, `VehicleService.listVehicles`, and the `GET /vehicles` route/response mapper updated to carry the real count through; unit tests added/updated in `vehicle.service.test.ts` and `vehicles.test.ts`; `docs/specs/garage/garage-list-api.md` updated (Decisions table, acceptance criteria, Out of scope) to reflect the real aggregate replacing the hardcoded-0 placeholder |

No mobile changes — `apps/mobile/domain/repositories/VehicleRepository.ts`'s `reconcile()` already spread the full server `VehicleSummary` (including `logEntryCount`) into local storage.

---

## Pre-ship audit

Following the bug fix, four parallel audits (mobile architecture compliance, API architecture compliance, docs-vs-code drift, ADR/spec quality on their own merits) produced a 26-item severity-ranked punch list (3 critical, 8 warning, 15 minor), published as a Claude.ai artifact and durably recorded in memory at `project-revlog-preship-audit-2026-07-03.md`. Top-line critical items: a mobile sync data-loss race for just-created vehicles (`VehicleRepository.reconcile()`), `LogEntryService` depending on a raw Prisma client instead of repositories, and a dead "Try again" button on the Garage error state (`console.log` TODO, the only such violation in the codebase, falsely checked off as done in its spec). This audit was research only — no fixes from it were implemented in this session.

The exercise also produced a corrected working norm, recorded in `feedback-minimize-approval-checkpoints.md`: decisions that shape structure going forward (new types, abstractions, naming conventions, API contracts, testing approach) must be surfaced for sign-off *before* implementation, not left for after-the-fact review.

---

## Verification

- **Vitest** (`pnpm --filter @maintenance-log/api test`): 270/270 tests passing, run both before and after the change, and again before this commit.
- **`tsc --noEmit`**: 3 pre-existing errors, confirmed via `git stash`/`git stash pop` comparison to already exist on `main` prior to this session's changes — unrelated to this fix.
- **`eslint`**: not run — no `eslint` binary reachable in this environment, a pre-existing gap.
- Mobile: no code changes, so no mobile test run was needed; `reconcile()`'s pass-through behavior was confirmed by reading, not by test.

---

## Out of scope

- All 26 pre-ship audit findings — a backlog for the user's own manual refactor pass, not addressed in this session.
- `Domain[Entity]` naming convention rename (e.g. `DomainVehicle` → `Vehicle`) — flagged as disliked but explicitly deferred, not part of this fix.
- True "most recently logged" sort order (still proxied by `Vehicle.updatedAt`) — pre-existing, unrelated gap noted in the spec's own Out of scope section, untouched here.
- Vehicle detail, edit, delete endpoints — separate spec, untouched.
