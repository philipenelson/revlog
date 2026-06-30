# Mobile Log Entry Spec

**Area:** Mobile / Log Entry
**Status:** Not started
**Last updated:** 2026-06-30

---

## Overview

Log entry creation and editing on mobile. Core use cases mirror the web spec (`docs/specs/garage/log-entry-screen.md`). This spec covers mobile-specific behaviour.

Mobile-specific differences:
- Reads come from local SQLite via `LogEntryRepository`.
- Writes (create, update, delete) are applied to local SQLite and queued in the outbox.
- Date input uses the native platform date picker (`DateTimePicker` from `@react-native-community/datetimepicker`).
- Mileage input uses a numeric keyboard.
- Media attachment is V2 — no file picker is shown in V1.

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

- [ ] New Log Entry screen defaults date to today and mileage field uses numeric keyboard
- [ ] Native date picker opens for date field on both iOS and Android
- [ ] Create writes Log Entry to SQLite + outbox in one transaction
- [ ] Edit pre-fills all fields from SQLite
- [ ] Update writes to SQLite + outbox; navigates back on success
- [ ] Delete shows confirmation dialog; removes from SQLite + adds outbox entry
- [ ] All operations succeed when device is offline; outbox entry is flushed when reconnected
- [ ] Title, date, and mileage are required; validation errors shown inline
- [ ] Log entry types are loaded from local SQLite (seeded from lookup endpoints on initial sync)

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Native date picker | `@react-native-community/datetimepicker` | Platform-native date input is significantly better UX than a custom picker on mobile |
| Media attachment | V2 | Keeps V1 scope tight; OPFS not available on mobile — FileSystemMediaStore adapter is a V2 item |
| Log entry types from SQLite | Seeded on initial sync from `GET /log-entry-types` | Avoids repeated API calls for static lookup data; works offline |

---

## Out of scope

- Media / photo attachment → V2
- Log entry type creation (custom types) → not in any V1 scope
