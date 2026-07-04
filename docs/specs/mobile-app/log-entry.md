# Mobile Log Entry Spec

**Area:** Mobile / Log Entry
**Status:** Implemented — New, Edit, and Delete Log Entry (UC-MOB-LOG-1 through UC-MOB-LOG-4) all built
**Last updated:** 2026-07-04

---

## Overview

Log entry creation and editing on mobile. Core use cases mirror the web spec (`docs/specs/garage/log-entry-screen.md`). This spec covers mobile-specific behaviour.

Mobile-specific differences:
- Reads come from local SQLite via `LogEntryRepository`.
- Writes (create, update, delete) are applied to local SQLite and queued in the outbox.
- Notes and item rows are cached locally in `log_entries` (`notes`, `items_json`, `detail_fetched` columns) so Edit Log Entry can pre-fill purely from SQLite — see this spec's Decisions and ADR 0027's 2026-07-04 update. `create()`/`update()` populate the cache immediately from the Owner's own input; entries first seen via sync get it from a bounded `SyncService.pull()` phase.
- Date input uses the native platform date picker (`DateTimePicker` from `@react-native-community/datetimepicker`).
- Mileage input uses a numeric keyboard.
- Media attachment is V2 — no file picker is shown in V1.

Design file: [`revlog-mobile-log-entry.html`](../../designs/mobile/revlog-mobile-log-entry.html)

---

## Use Cases

### UC-MOB-LOG-1 — Owner creates a log entry

**Actor:** Owner
**Precondition:** Owner is on Vehicle Detail; taps `[+ Log entry]`.
**Milestones:** [V1](../../milestones/v1.md)

1. App navigates to the New Log Entry screen.
2. Owner fills in: title, type (picker), date (native date picker, defaults to today), mileage at entry (numeric keyboard), notes (optional), and one or more items (action + optional parts).
3. Owner taps `[Save]`.
4. App validates the form (title required; date required; mileage required and non-negative).
5. On valid: writes Log Entry to local SQLite; adds `CREATE_LOG_ENTRY` outbox entry in the same transaction. Navigates back to Vehicle Detail.

---

### UC-MOB-LOG-2 — Owner edits a log entry

**Actor:** Owner
**Precondition:** Owner is on Vehicle Detail; taps an existing Log Entry.
**Milestones:** [V1](../../milestones/v1.md)

1. App navigates to the Edit Log Entry screen, pre-filled from local SQLite.
2. Owner modifies fields and taps `[Save]`.
3. App validates and writes the update to local SQLite; adds `UPDATE_LOG_ENTRY` outbox entry.
4. Navigates back to Vehicle Detail.

---

### UC-MOB-LOG-3 — Owner deletes a log entry

**Actor:** Owner
**Precondition:** Owner is on the Edit Log Entry screen.
**Milestones:** [V1](../../milestones/v1.md)

1. Owner taps `[Delete entry]`.
2. App shows confirmation dialog: "Delete this log entry? This cannot be undone."
3. Owner confirms.
4. App deletes the Log Entry from local SQLite; adds `DELETE_LOG_ENTRY` outbox entry.
5. Navigates back to Vehicle Detail.

---

### UC-MOB-LOG-4 — Owner creates a log entry while offline

**Actor:** Owner
**Precondition:** Device has no connectivity; Owner is on the New Log Entry screen.
**Milestones:** [V1](../../milestones/v1.md)

1. Owner fills in and saves the log entry.
2. App writes to local SQLite + outbox in one transaction. Same success flow as UC-MOB-LOG-1.
3. Offline indicator in header shows pending sync.
4. When connectivity is restored, SyncService flushes the outbox entry to the API.

---

## Acceptance Criteria

- [x] New Log Entry screen defaults date to today and mileage field uses numeric keyboard
- [x] Native date picker opens for date field on both iOS and Android
- [x] Create writes Log Entry to SQLite + outbox in one transaction
- [x] Edit pre-fills all fields (including notes and items) from SQLite
- [x] Update writes to SQLite + outbox; navigates back on success
- [x] Delete shows confirmation dialog; removes from SQLite + adds outbox entry
- [x] Create succeeds when device is offline; outbox entry is flushed when reconnected (UC-MOB-LOG-4). Update/delete follow the same outbox path (`UPDATE_LOG_ENTRY`/`DELETE_LOG_ENTRY` handlers), verified via unit tests rather than a dedicated offline E2E scenario.
- [x] Title, date, and mileage are required; validation errors shown inline
- [x] Log entry type/category ids come from the shared `LogEntryTypeId`/`ItemCategoryId` enum (`@maintenance-log/domain`'s `lookup-constants.ts`); displayed labels are UI-layer constants, not DB-backed

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Native date picker | `@react-native-community/datetimepicker` | Platform-native date input is significantly better UX than a custom picker on mobile |
| Media attachment | V2 | Keeps V1 scope tight; OPFS not available on mobile — FileSystemMediaStore adapter is a V2 item |
| Log entry type/category labels | Shared `LogEntryTypeId`/`ItemCategoryId` enum (`@maintenance-log/domain`'s `lookup-constants.ts`) for the ids; `TYPE_LABELS`/`CATEGORY_LABELS` display constants local to `NewLogEntryScreen.tsx` (and duplicated in `EditLogEntryScreen.tsx`) for the label text | Ids are a plain shared enum, not a database concept. Rendered label text is a UI-layer concern — same approach as the web screen's own `TYPE_META`/`CATEGORY_META` constants |
| Local detail cache (notes + items) for Edit | `log_entries` gains `notes`/`items_json`/`detail_fetched` columns; `create()`/`update()` populate them immediately, `SyncService.pull()` fetches them via `GET /vehicles/:vehicleId/log/:entryId` only for entries not yet cached | `GET /vehicles/:vehicleId` (the only pull source for Log Entries) returns summaries only — never notes or item rows — so Edit's pre-fill and `PATCH`'s full-array item replacement both needed a real local cache, not just a missing nice-to-have. See ADR 0027's 2026-07-04 update for the full option comparison and reasoning |
| Log Entry deletion navigates via `router.back()`, not `dismissTo()` | Edit Log Entry pops back to the same Vehicle Detail instance it was pushed from | Unlike deleting a Vehicle (which removes the whole Detail screen), deleting a Log Entry only removes one entry from a Vehicle Detail that's still valid to show; its own `useFocusEffect` re-reads local Log Entries on return |

---

## Out of scope

- Media / photo attachment → V2
- Log entry type creation (custom types) → not in any V1 scope
