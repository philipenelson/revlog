# Log Entry Screen Spec

**Area:** Garage
**Routes:** `/garage/[vehicleId]/log/new` (create), `/garage/[vehicleId]/log/[entryId]` (view/edit)
**Status:** Not started
**Last updated:** 2026-06-09

---

## Overview

The Log Entry screen serves two modes on the same component: creating a new Log Entry and viewing or editing an existing one. An Owner records what happened to their Vehicle on a given date — type, title, mileage, items used or costs incurred, and any photos or videos — and the screen handles persistence both to the API (structured data) and to local storage (media files, via the MediaStore).

This is the core value-capture screen of Revlog: every oil change, repair, track day, and incident gets its permanent record here.

---

## Layout

Single scrollable page — no wizard steps or tabs. All sections are always visible; optional fields are visually de-emphasised.

**Header:** `←` back to Vehicle Detail (`/garage/[vehicleId]`), title "New log entry" or "Edit log entry", and a `[Save]` button (top-right, disabled until required fields are filled).

**1. Type** (required)
Pill/toggle row. One type selected at a time. Types sourced from `GET /log-entry-types` on mount (stable seed: `MAINTENANCE`, `REPAIR`, `INSPECTION`, `MODIFICATION`, `INCIDENT`, `EVENT`, `OTHER`). Each pill shows a label; hovering or focusing shows a tooltip with a description (frontend-only constants, not stored in the database):

| Type ID | Label | Tooltip |
|---|---|---|
| `MAINTENANCE` | Maintenance | Routine upkeep — oil change, tyre swap, chain service |
| `REPAIR` | Repair | Fixing something broken or damaged |
| `INSPECTION` | Inspection | Periodic checks, pre-trip, annual inspection |
| `MODIFICATION` | Modification | Aftermarket parts, upgrades, customisation |
| `INCIDENT` | Incident | Crash, damage, breakdown — the "oh no" log |
| `EVENT` | Event | Track day, rally, road trip |
| `OTHER` | Other | Anything that doesn't fit the above |

**2. Title** (required, max 100 characters)
Text input. Placeholder: "e.g. 25,000 km service". This is the short display name shown in all Log Entry card views.

**3. Date and time**
- Date (required): date picker, defaults to today
- Time (optional): time input ("HH:mm"), same row as date. Placeholder: "e.g. 14:30"

**4. Odometer reading** (optional)
Number input with "mi" suffix label. Helper text below: "Updates your vehicle's odometer if higher than current reading."

**5. Notes** (optional)
Multi-line textarea. Placeholder: "Full synthetic 10W-40. Slightly dark when drained — next change at 13,200 mi."

**6. Items & costs**
Section heading "Items & costs" with an `[+ Add item]` button. Dynamic table:
- Empty state: "No items added" with an `[+ Add item]` CTA
- Each row: Description (text, required per row), Category pill/select (PART, LABOR, FEE, OTHER), Quantity (optional, default 1), Unit cost (optional currency), Row total (qty × unit cost, auto-calculated, read-only), `[×]` delete button

Category tooltips (frontend constants):

| Category ID | Label | Tooltip |
|---|---|---|
| `PART` | Part | A physical component used or replaced |
| `LABOR` | Labor | Work performed — mechanic or your own time |
| `FEE` | Fee | Shop fee, disposal, tax |
| `OTHER` | Other | Anything else |

Table footer: **Total** (sum of all row totals, formatted as currency).

**7. Photos & videos**
Section heading "Photos & videos" with a file picker button. Accepts `image/*` and `video/*`. Per-file limits: images 10 MB, videos 100 MB. Maximum 10 files per Log Entry (combined). Files stored locally via the MediaStore (OPFS in V1 — see [media-store.md](./media-store.md)).

Preview grid: image thumbnails, video poster frames. Each preview has a `[×]` remove button and an optional caption text input below it. Upload errors shown inline per file (too large, unsupported type).

**8. Save action**
`[Save log entry]` primary button at the bottom of the page (same action as the header Save button).

In **edit mode only**: a `[Delete entry]` destructive text link below the save button. Selecting it opens a confirmation dialog ("Delete this log entry? This cannot be undone.") before proceeding.

---

## Use cases

### UC-LOG-1 — Create a minimal log entry

**Actor:** Owner
**Precondition:** Owner is authenticated; has navigated to `/garage/[vehicleId]/log/new`
**Milestones:** [V1](../../milestones/v1.md)

1. Owner selects a type, enters a title, and confirms the date (defaults to today)
2. Owner selects `[Save]`
3. System calls `POST /vehicles/:vehicleId/log` with the filled fields
4. On success, system navigates back to `/garage/[vehicleId]` and the new Log Entry appears at the top of the Service History

---

### UC-LOG-2 — Create a log entry with items and costs

**Actor:** Owner
**Precondition:** Owner is authenticated; on the new log entry screen
**Milestones:** [V1](../../milestones/v1.md)

1. Owner fills in type, title, and date
2. Owner selects `[+ Add item]`, enters a description, selects a category, and optionally fills quantity and unit cost
3. Owner adds further items as needed
4. The total updates automatically as unit costs and quantities are entered
5. Owner selects `[Save]`; system persists the entry with all items

---

### UC-LOG-3 — Attach photos and videos to a log entry

**Actor:** Owner
**Precondition:** Owner is authenticated; on the new or edit log entry screen
**Milestones:** [V1](../../milestones/v1.md)

1. Owner selects the file picker button and chooses one or more image or video files
2. System validates each file (type and size); rejects any that exceed the limits with an inline per-file error
3. Valid files are stored locally via the MediaStore and appear in the preview grid
4. Owner optionally adds captions to previews
5. On save, the media refs (OPFS paths + mediaType) are included in the API payload alongside the structured data

---

### UC-LOG-4 — Log entry mileage auto-updates the vehicle odometer

**Actor:** Owner
**Precondition:** Owner is saving a Log Entry with a mileage value higher than the Vehicle's current `mileage`
**Milestones:** [V1](../../milestones/v1.md)

1. Owner fills in the odometer reading field with a value greater than the Vehicle's current mileage
2. Owner saves the Log Entry
3. System persists the entry; API side effect updates `Vehicle.mileage` to the new value
4. The stats strip on the Vehicle Detail screen now reflects the updated odometer

---

### UC-LOG-5 — Edit an existing log entry

**Actor:** Owner
**Precondition:** Owner has navigated to `/garage/[vehicleId]/log/[entryId]`; entry exists and belongs to the Vehicle
**Milestones:** [V1](../../milestones/v1.md)

1. System fetches the existing entry and pre-fills all form fields
2. Owner modifies any fields
3. Owner selects `[Save]`; system calls `PATCH /vehicles/:vehicleId/log/:entryId`
4. On success, system navigates back to `/garage/[vehicleId]`

---

### UC-LOG-6 — Delete a log entry

**Actor:** Owner
**Precondition:** Owner is on the edit screen for an existing Log Entry
**Milestones:** [V1](../../milestones/v1.md)

1. Owner selects `[Delete entry]`
2. System shows a confirmation dialog
3. Owner confirms; system calls `DELETE /vehicles/:vehicleId/log/:entryId`
4. On success, system navigates back to `/garage/[vehicleId]` and the entry no longer appears in the Service History

---

## Acceptance Criteria

### Type selector

- [ ] All 7 types render as pills; exactly one is selected at a time
- [ ] Tooltip with the description text appears on hover/focus for each pill
- [ ] No type is pre-selected in create mode; existing type is pre-selected in edit mode

### Title

- [ ] Title field is required; Save is disabled when it is empty
- [ ] Input accepts up to 100 characters; input beyond 100 is rejected or truncated with a visible counter

### Date and time

- [ ] Date field defaults to today in create mode; pre-fills from entry data in edit mode
- [ ] Time field is optional; accepts "HH:mm" format; pre-fills from entry data in edit mode
- [ ] Invalid time format shows an inline validation error

### Odometer reading

- [ ] Field is optional; accepts positive integers only
- [ ] Helper text reads "Updates your vehicle's odometer if higher than current reading"

### Items and costs

- [ ] `[+ Add item]` adds a new row to the table
- [ ] Each row has: Description (required), Category selector, Quantity, Unit cost, auto-calculated Row total, Delete button
- [ ] Row total updates in real time as quantity or unit cost changes
- [ ] Table footer Total is the sum of all row totals, updated in real time
- [ ] `[×]` on a row removes it; Total recalculates
- [ ] Category tooltips appear on hover/focus

### Photos and videos

- [ ] File picker accepts `image/*` and `video/*`
- [ ] Files exceeding 10 MB (images) or 100 MB (videos) are rejected with a per-file inline error message
- [ ] Unsupported file types are rejected with a per-file inline error message
- [ ] Up to 10 files can be attached; attempting to add more shows an error
- [ ] Each preview shows a thumbnail (image) or poster frame (video)
- [ ] Each preview has a `[×]` remove button; removing a file deletes it from the MediaStore
- [ ] Each preview has an optional caption text input

### Save and navigation

- [ ] `[Save]` and the bottom save button are disabled while required fields are missing or while a save request is in flight
- [ ] Successful save navigates back to `/garage/[vehicleId]`
- [ ] Save failure shows an inline error below the save button; the form remains editable
- [ ] Navigating away with unsaved changes shows a confirmation prompt

### Edit mode

- [ ] All fields pre-fill from the existing entry on load
- [ ] Loading state shown while the existing entry is being fetched
- [ ] Error state with retry shown if fetching the existing entry fails
- [ ] `[Delete entry]` link is shown only in edit mode
- [ ] Selecting `[Delete entry]` opens a confirmation dialog
- [ ] Confirming deletion calls `DELETE`; navigates back to Vehicle Detail on success
- [ ] Cancelling the deletion dialog returns to the form without changes

### Mileage auto-update

- [ ] When the saved mileage is higher than the Vehicle's current `mileage`, the Vehicle's odometer is updated (verified via the Vehicle Detail stats strip showing the new value after save)
- [ ] When the saved mileage is lower than or equal to the current Vehicle mileage, no odometer update occurs

### General

- [ ] Page title is "Revlog — New log entry" (create) or "Revlog — Edit log entry" (edit)
- [ ] An error boundary wraps the page

### E2E tests (Cypress)

- [ ] Create mode: all 7 type pills render; selecting one highlights it
- [ ] Create minimal entry (type + title + date) and verify it appears in the Vehicle Detail service history
- [ ] Create entry with items; verify item rows, auto-calculated totals, and persisted costs
- [ ] Create entry with a mileage value higher than vehicle mileage; verify Vehicle Detail odometer updates
- [ ] Attach an image, verify preview, and save; verify media ref persisted
- [ ] Attempt to attach an oversized file; verify per-file error
- [ ] Edit mode: form pre-fills from fixture data
- [ ] Edit and save; verify changes appear in the service history
- [ ] Delete entry flow: confirmation dialog appears, confirm deletes and navigates back

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Single scrollable page (no steps) | All sections on one scroll rather than a multi-step wizard | Log entries are quick to fill; a wizard would add friction for simple entries (type + title + date) and offer no benefit for complex ones — all sections are always accessible |
| Items as full replacement on PATCH | `PATCH` sends the entire items array; service deletes old rows and inserts new | Avoids complexity of a per-item diff API (`PATCH /log-entry/:id/items/:itemId`) for V1; entry item counts are small so the full replacement is negligible |
| Media stored locally via MediaStore | OPFS-backed `MediaStore` (see [media-store.md](./media-store.md)); `path` refs stored in `LogMedia` table | No server storage costs in V1; clean interface swap for cloud storage in V2 |
| Tooltip descriptions are frontend constants | Type and category descriptions live in a TS constants file, not the database | Display metadata is a UI concern (and eventually an i18n concern); the DB stores only the stable ID |
| Type fetched from API | Type IDs loaded from `GET /log-entry-types` at runtime | Consistent with the DB-stored type model; allows new types to be seeded without a frontend deploy |

---

## Next steps

### Wire real type IDs from API
The type pill list should be fetched from `GET /log-entry-types` and merged with the frontend display constants (label, tooltip, icon). A fallback to the hardcoded constant list avoids a broken UI if the fetch fails.

---

## Out of scope

- Log Entry detail view as a separate read-only screen (edit mode serves viewing in V1)
- Bulk deletion of Log Entries
- Copying/duplicating a Log Entry
- Rich text notes (plain textarea in V1)
- Video compression or thumbnail generation (V2, when MediaStore moves to cloud)
