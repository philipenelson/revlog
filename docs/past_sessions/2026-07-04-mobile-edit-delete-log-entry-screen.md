# Session: Mobile — Edit and Delete Log Entry (UC-MOB-LOG-2, UC-MOB-LOG-3)

**Date:** 2026-07-04
**Branch:** `main` (in-place — no worktree for this session)

---

## Goal

User asked to "implement the edit and delete log entry flows." `docs/specs/mobile-app/log-entry.md` already documented UC-MOB-LOG-2 (edit) and UC-MOB-LOG-3 (delete) with use cases and acceptance criteria, and `EditLogEntryScreen.tsx`/the `app/garage/[vehicleId]/log/[entryId].tsx` route already existed as a 5-line `ScreenPlaceholder` stub from an earlier nav-scaffolding commit, same shape as New Log Entry's own starting point the session before. Vehicle Detail's log-entry-card tap already routed to it.

Investigation before writing any code surfaced a real gap the existing spec's acceptance criteria had glossed over: the local `log_entries` SQLite table only ever stored `LogEntrySummary` fields (title, date, mileage, item/media counts, totalCost) because that's all `GET /vehicles/:vehicleId` — the only pull source for Log Entries — returns. Neither notes nor the actual item rows were cached anywhere locally, and since `PATCH` does a full-array replace of items, editing with an empty cached item list would have silently deleted an Owner's real items on save. This was a genuine architecture fork (how does Edit's pre-fill get real data), not a mechanical implementation detail, so it was put to the user directly before any code was written.

---

## Key decisions

**Detail-sourcing approach — put to the user via AskUserQuestion, not decided unilaterally.** Two options were presented: (1) extend `SyncService.pull()` to fetch full detail (`GET /vehicles/:vehicleId/log/:entryId`) for entries not yet cached, mirroring the existing Vehicle Detail precedent (ADR 0027's 2026-07-03 update); or (2) fetch on-demand when Edit Log Entry opens, a new exception to "viewmodels never call services." The user chose option 1. Scoped narrower than Vehicle Detail's own precedent, though: only entries `reconcile()` has never cached detail for are fetched, not every entry on every pull — Log Entries can run to "dozens to low hundreds" per `docs/adr/0018-log-entry-data-model.md`'s own sizing, unlike the small, bounded Vehicle count Vehicle Detail's unconditional per-vehicle refetch was written against. Full reasoning and the local schema this produced (`notes`, `items_json`, `detail_fetched` columns) are in ADR 0027's 2026-07-04 update.

**Log Entry deletion navigates via `router.back()`, not `dismissTo()`.** Unlike deleting a Vehicle (which removes the whole Detail screen Edit Vehicle was pushed from, requiring a `dismissTo('/garage')`), deleting a Log Entry only removes one entry from a Vehicle Detail screen that's still valid to show underneath — its own `useFocusEffect` re-reads local Log Entries on return, so a plain `back()` is correct and simpler.

---

## What was built

| Commit | SHA | Description |
|---|---|---|
| 1 | `901d86f` | ADR 0027 update: local detail cache + bounded sync fetch, written before any code (per this repo's documentation-first rule) |
| 2 | `04e3506` | `log_entries` schema gains `notes`/`items_json`/`detail_fetched`; `LogEntryRepository` gains `findById`, `update`, `delete`, `applyDetail`; `create()`/`update()` populate detail immediately; `reconcile()` carries cached detail forward and reports which entries still need a fetch |
| 3 | `2d649fd` | `SyncService.pull()`'s new bounded detail-fetch phase; `outboxHandlers.ts` gains `UPDATE_LOG_ENTRY`/`DELETE_LOG_ENTRY`, same retry/permanent-failure classification as the existing vehicle handlers |
| 4 | `2a05e6c` | `EditLogEntryScreen.tsx` + `useEditLogEntryViewModel.ts` — pre-fills from `logEntryRepository.findById()`, mirrors New Log Entry's form plus Edit Vehicle's delete-confirmation `Modal` |
| 5 | `8f70e2a` | Appium E2E spec (`edit-log-entry.e2e.ts`): pre-fill, save + return with updated values, validation error, cancel, delete confirm/cancel; updated `vehicle-detail.e2e.ts`'s now-stale placeholder assertion; fixed the now-stale `createLogEntryViaApi` comment in `authFixtures.ts` |
| 6 | `cef45a2` | `docs/specs/mobile-app/log-entry.md`: Status line, acceptance criteria, Decisions table |
| 7 | _(this commit)_ | `docs/milestones/v1.md` checkbox + this session summary |

---

## Verification

- **Jest** (`pnpm --filter @maintenance-log/mobile test`): 18 suites, 194 tests, all passing — including new/updated coverage for `LogEntryRepository` (findById, update, delete, applyDetail, reconcile's carry-forward + needs-detail reporting), `SyncService`'s new detail-fetch phase (fetches only flagged ids, skips already-cached ones, logs and continues on a failed fetch), the two new outbox handlers (success, 5xx/network retryable, 4xx permanent), and `useEditLogEntryViewModel` (pre-fill, not-found, validation, save, comma-stripped mileage, notes trimming, item add/edit/remove/totals, dropped blank rows, submit failure, date picker, delete dialog open/close/confirm/cancel/in-flight).
- **`tsc --noEmit`**: clean for both the app (`apps/mobile`) and the E2E suite (`e2e/tsconfig.json`).
- **Not done — no live simulator available in this environment**: the new `edit-log-entry.e2e.ts` specs and the updated `vehicle-detail.e2e.ts` assertion were not run against a real iOS/Android simulator + backend + Mailpit, same gap flagged in prior mobile session summaries.
- **`eslint`**: not run — no `eslint` binary reachable in this environment, a pre-existing gap already flagged in prior mobile session summaries.

---

## Out of scope

- Media/photo attachment on Log Entries — V2 per the spec, untouched.
- A dedicated offline E2E scenario for update/delete (mirroring UC-MOB-LOG-4's create-while-offline coverage) — the outbox path is unit-tested (handler classification, repository writes) but not driven through a live offline Appium run; UC-MOB-LOG-4's own spec text already scopes that acceptance criterion to create only.
- Extending the sync detail-fetch to re-fetch already-cached entries (e.g. to pick up an edit made from another device) — deliberately out of scope per the ADR update's reasoning; Log Entries are treated as effectively append-only from this device's point of view once their detail is cached.
- Anything on the web side or the API — already shipped in prior sessions, untouched here.
