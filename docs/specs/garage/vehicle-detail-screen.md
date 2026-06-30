# Vehicle Detail Screen Spec

**Area:** Garage
**Route:** `/garage/[vehicleId]`
**Status:** Not started
**Last updated:** 2026-06-28

---

## Overview

The Vehicle Detail screen is the Owner's window into a single Vehicle — its identity, insurance status, and complete Service History. From here an Owner can read every Log Entry ever recorded for their bike, start a new entry, navigate to edit the Vehicle, or manage insurance information.

This screen is the primary destination reached by selecting a Vehicle card in the Garage ([UC-GARAGE-3](./garage-screen.md#uc-garage-3--open-a-vehicles-service-history-from-the-garage)) and acts as the hub for all Log Entry interactions in V1.

---

## Layout

- **Top bar** — a back link (`← Garage`) to `/garage`, the Revlog wordmark, and action buttons: `[✎ Edit]` (navigates to `/garage/[vehicleId]/edit`), `[Share report]` (opens the Share Report dialog — [`mechanic-printout.md`](./mechanic-printout.md)), `[Transfer]` (opens the Transfer dialog — [`vehicle-transfer.md`](./vehicle-transfer.md)), and `[+ Log entry]` (navigates to `/garage/[vehicleId]/log/new`). When a Vehicle Transfer is pending, the top bar buttons are replaced — see **Locked state** below.
- **Hero panel** — full-width panel with a dark gradient overlay at the bottom: Vehicle photo if `photoUrl` is set; otherwise the Vehicle glyph illustration in the same style as the Garage card. Overlaid at the bottom: display name (Nickname if set, else "Make Model") and "Make · Model · Year"
- **Stats strip** — four horizontal stat blocks: Odometer (formatted with "mi" unit), Log entries (count or "None"), Last logged (date of most recent Log Entry or "Never"), Total spent (formatted as currency or "—" when zero)
- **Insurance row** — a compact single-line element below the stats strip: a shield icon followed by the expiry date ("Expires Jun 1 2026") when insurance is on file, or "No insurance on file" in muted text when not set. A `[Details →]` / `[Add →]` button opens the Insurance dialog. Row renders in warning colour when expiry is within 30 days.
- **Insurance dialog** — a modal/dialog overlay: all insurance fields in read mode, an Edit action to switch to inline edit, and Save / Cancel. All fields are optional. Fields: company, policy number, start date, expiry date, premium + period, tow number, notes.
- **Service history section** — heading "Service history", a type filter dropdown (All, Maintenance, Repair, Inspection, Modification, Incident, Event, Other), and a sort control (date descending by default). Body is one of: loading state, empty state, or the Log Entry list.

**Log Entry card:**
- Type badge with icon and label (wrench → Maintenance, lightning → Repair, magnifying glass → Inspection, sparkle → Modification, warning triangle → Incident, flag → Event, ellipsis → Other)
- Entry title (bold), date, mileage at entry (if set)
- Total cost (sum of items; hidden when zero)
- Secondary line: item count and media count
- Entire card is a link to `/garage/[vehicleId]/log/[entryId]`

---

## Use cases

### UC-VDETAIL-1 — View a vehicle's service history

**Actor:** Owner
**Precondition:** Owner is authenticated; Vehicle exists and belongs to their Account; Vehicle has at least one Log Entry
**Milestones:** [V1](../../milestones/v1.md)

1. Owner navigates to `/garage/[vehicleId]` (via a Garage card)
2. System fetches `GET /vehicles/:vehicleId` and renders a loading state
3. Once loaded: hero shows photo or glyph; stats strip reflects real totals; insurance row reflects current insurance state; service history shows all Log Entries sorted newest-first
4. Owner scrolls the history and selects a Log Entry card
5. System navigates to `/garage/[vehicleId]/log/[entryId]`

---

### UC-VDETAIL-2 — View a vehicle with no log entries

**Actor:** Owner
**Precondition:** Owner is authenticated; Vehicle exists; Vehicle has zero Log Entries
**Milestones:** [V1](../../milestones/v1.md)

1. Owner navigates to `/garage/[vehicleId]`
2. System renders the hero and stats strip (Log entries: "None", Last logged: "Never", Total spent: "—")
3. Service history section renders an empty state with headline and a "Add your first log entry" CTA

---

### UC-VDETAIL-3 — Start a new log entry from the vehicle detail screen

**Actor:** Owner
**Precondition:** Owner is viewing the Vehicle Detail screen
**Milestones:** [V1](../../milestones/v1.md)

1. Owner selects `[+ Log entry]` in the top bar or the empty-state CTA
2. System navigates to `/garage/[vehicleId]/log/new`

---

### UC-VDETAIL-4 — Add or edit insurance information

**Actor:** Owner
**Precondition:** Owner is viewing the Vehicle Detail screen
**Milestones:** [V1](../../milestones/v1.md)

**Adding (no record on file):**
1. Owner sees "No insurance on file" and selects `[Add →]`
2. System opens the Insurance dialog with all fields empty and in edit mode
3. Owner fills in any fields they wish (all are optional) and selects Save
4. System calls `PUT /vehicles/:vehicleId/insurance`, closes the dialog on success, and updates the insurance row

**Viewing and editing (record exists):**
1. Owner selects `[Details →]`
2. System opens the Insurance dialog in read mode
3. Owner selects Edit, modifies fields, and selects Save
4. System calls `PUT /vehicles/:vehicleId/insurance`, updates the record, and closes the dialog

**Expiry warning:**
- If `expiryDate` is within 30 days of today, the insurance row renders in warning (orange) colour

---

### UC-VDETAIL-5 — Navigate to edit the vehicle

**Actor:** Owner
**Precondition:** Owner is viewing the Vehicle Detail screen
**Milestones:** [V1](../../milestones/v1.md)

1. Owner selects `[✎ Edit]` in the top bar
2. System navigates to `/garage/[vehicleId]/edit`

> The Edit Vehicle screen is a separate milestone item requiring its own spec. This use case covers only the navigation affordance.

---

## Acceptance Criteria

### Hero and metadata

- [ ] Hero shows Vehicle photo (full-width, dark gradient overlay at bottom) when `photoUrl` is set
- [ ] Hero shows Vehicle glyph illustration when no `photoUrl` is set
- [ ] Overlaid text shows display name (Nickname if set, else "Make Model") and "Make · Model · Year"
- [ ] Top bar `[✎ Edit]` button navigates to `/garage/[vehicleId]/edit`
- [ ] Top bar `[+ Log entry]` button navigates to `/garage/[vehicleId]/log/new`
- [ ] Top bar back link navigates to `/garage`

### Stats strip

- [ ] Odometer shows `vehicle.mileage` with thousands separators and "mi" unit
- [ ] Log entries shows count, or "None" when zero
- [ ] Last logged shows the date of the most recent Log Entry (e.g. "Jun 3 2025"), or "Never" when none
- [ ] Total spent shows the sum of all Log Entry item costs formatted as currency (e.g. "$1,840"), or "—" when zero

### Insurance row

- [ ] No insurance record: row shows "No insurance on file" in muted text and `[Add →]` button
- [ ] Insurance record exists: row shows shield icon, "Expires [date]" (or no expiry indicator if `expiryDate` is null), and `[Details →]` button
- [ ] Row renders in warning colour when `expiryDate` is set and within 30 days of today
- [ ] `[Add →]` opens the Insurance dialog with empty fields in edit mode
- [ ] `[Details →]` opens the Insurance dialog in read mode showing all stored fields
- [ ] Insurance dialog allows switching to edit mode and saving via `PUT /vehicles/:vehicleId/insurance`
- [ ] Dialog save shows a loading state while the request is in flight; shows an inline error on failure
- [ ] Dialog closes on successful save; insurance row updates to reflect the new data

### Service history

- [ ] Type filter dropdown defaults to "All" and hides entries of other types when a specific type is selected
- [ ] Sort defaults to date descending (newest first)
- [ ] Each Log Entry card shows: type badge (icon + label), title, date, mileage at entry (if set), total cost (if non-zero), item count, media count
- [ ] Each card is a link to `/garage/[vehicleId]/log/[entryId]`
- [ ] Empty state renders when there are zero Log Entries, with a "Add your first log entry" CTA linking to `/garage/[vehicleId]/log/new`

### Data loading and error handling

- [ ] Loading state shown while `GET /vehicles/:vehicleId` is in flight
- [ ] Error state with "Try again" shown on request failure; retry re-fetches and recovers
- [ ] 403 and 404 responses both render a "Vehicle not found" state with a link back to `/garage`
- [ ] No in-memory session redirects to `/login`

### General

- [ ] Page title is "Revlog — [Vehicle display name]"
- [ ] An error boundary wraps the page

### E2E tests (Cypress)

- [ ] Vehicle with photo renders photo in hero; vehicle without photo renders glyph
- [ ] Stats strip values match fixture data (mileage, entry count, last logged, total spent)
- [ ] Insurance row shows expiry when insurance is on file; shows "No insurance on file" when not
- [ ] `[Add →]` and `[Details →]` open the Insurance dialog; save and close update the row
- [ ] Service history list renders all Log Entry cards with correct type badges, titles, and metadata
- [ ] Type filter hides entries of other types
- [ ] Selecting a Log Entry card navigates to the correct URL
- [ ] Empty history state renders; CTA navigates to `/garage/[vehicleId]/log/new`
- [ ] Error state renders on API failure; recovers on retry
- [ ] `[+ Log entry]` navigates to `/garage/[vehicleId]/log/new`
- [ ] `[✎ Edit]` navigates to `/garage/[vehicleId]/edit`

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Insurance as compact row + dialog | Single-line badge that opens a dialog | Insurance details are infrequently reviewed; keeping them collapsed avoids pushing Service History — the screen's primary content — down the page |
| Expiry warning threshold | 30 days | Enough lead time to act without triggering anxiety prematurely |
| Type filter client-side | Filter and sort applied client-side on the fetched list | Entry counts per Vehicle are expected to stay small in V1; server-side filter/pagination is V2 when the list grows |
| Stats computed server-side | `totalSpent` and `lastLoggedAt` returned by the API rather than computed in the component | Avoids summing potentially large lists client-side; consistent with the Garage card's `logEntryCount` pattern |
| Edit Vehicle as separate navigation | `[✎ Edit]` navigates away rather than enabling inline editing | Keeps the detail screen read-focused; inline editing of multi-field forms risks accidental edits |

---

## Next steps

### Locked state — Vehicle Transfer pending
When `GET /vehicles/:vehicleId` returns `transferPending: true`, the top bar must replace all action buttons with a "Transfer pending" banner. See [`vehicle-transfer.md`](./vehicle-transfer.md) for the full locked-state spec.

### Share Report dialog
`[Share report]` in the top bar opens the share dialog. Full spec in [`mechanic-printout.md`](./mechanic-printout.md).

### Delete Vehicle
Permanent deletion is surfaced in the danger zone of the Edit Vehicle screen. Full spec in [`delete-vehicle.md`](./delete-vehicle.md).

### Pagination for large service histories
Client-side filtering works while entry counts stay small. Once entries grow, `GET /vehicles/:vehicleId` should return a paginated log entry list with server-side type filtering.

---

## Out of scope

- Edit Vehicle screen and `PATCH /vehicles/:vehicleId` — [`edit-vehicle.md`](./edit-vehicle.md)
- Scheduled Maintenance Item reminders → V2
- Multi-media gallery view for attachments → V2
