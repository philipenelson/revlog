# Session: Vehicle detail, log entry, and insurance — specs, ADRs, and design previews

**Date:** 2026-06-09
**Branch/worktree:** `worktree-specs-vehicle-log`

---

## Goal

Design and fully document the vehicle detail screen, the log entry create/edit screen, and vehicle insurance. Write all specs, ADRs, and milestone updates before any code is written, then produce interactive HTML design previews for the two new screens.

---

## Key decisions

- **Log entry type and item category stored as DB lookup tables, not Prisma enums** — `LogEntryType` and `ItemCategory` have only `id String @id`; no other fields. The frontend maps IDs to labels, icons, and i18n keys entirely in TypeScript constants. This keeps analytics simple (`GROUP BY type_id`) and lets a new type be seeded without a Prisma migration. See ADR 0018. Back-relations on the lookup tables (`entries LogEntry[]`, `items LogItem[]`) are Prisma-required syntax only — must never be `include`d in queries.

- **MediaStore as Port/Adapter, not Repository** — local media files don't map to a domain aggregate, so the Repository pattern would be a misnomer. V1 uses `OpfsMediaStore` (browser's Origin Private File System — no permission prompts, persistent). V2 swaps in `CloudMediaStore` with file compression at upload. Injection via React context. See ADR 0019.

- **OPFS over File System Access API** — OPFS requires no user permission prompts and persists within the browser origin automatically. File System Access API would require the user to pick a folder, adding friction to a "should feel like attaching a photo to a message" interaction.

- **Log entry items as full array replacement on PATCH** — no per-item diff API. Client sends the full desired items array; the server deletes all existing items for the entry and inserts the new set in one transaction. Simpler contract, no item IDs needed by the client.

- **Insurance as 1:1 per vehicle, all fields optional, PUT as upsert** — zero mandatory fields to avoid forcing users to provide data they don't have. `PUT /vehicles/:vehicleId/insurance` creates or replaces the entire record (upsert). `DELETE /vehicles/:vehicleId/insurance` removes it. `PremiumPeriod` enum: `MONTHLY`, `QUARTERLY`, `BIANNUAL`, `ANNUAL`.

- **Mileage auto-update via conditional SQL** — `UPDATE vehicles SET mileage = ? WHERE id = ? AND mileage < ?`. Atomically updates only if the log entry's mileage exceeds the vehicle's current value. No rollback on log entry delete — the vehicle's odometer is a high-water mark, not a derived value.

- **Insurance UI: compact shield badge row → dialog** — avoids cluttering the vehicle detail screen. A single line shows the expiry date (or "N/A"), clicking opens a dialog to view/edit all fields. The detail screen stays focused on service history.

- **Vehicle detail stats panel** — top-level stats (total spent, total entries, last service date, current mileage) computed from log entries in the vehicle detail API response. No separate stats endpoint.

---

## What was documented (9 files)

### Specs
- `docs/specs/garage/vehicle-detail-screen.md` — `/garage/[vehicleId]` screen: hero panel, stats strip, insurance row + dialog, service history list. Use cases UC-VDETAIL-1 through UC-VDETAIL-5.
- `docs/specs/garage/log-entry-screen.md` — `/garage/[vehicleId]/log/new` (create) and `/garage/[vehicleId]/log/[entryId]` (edit). 7-section form: type pills with tooltips, title, date+time, odometer, notes, items table, media. Use cases UC-LOG-1 through UC-LOG-6.
- `docs/specs/garage/vehicle-detail-api.md` — `GET /vehicles/:vehicleId`: vehicle fields, insurance (nullable), log entry summaries, computed stats.
- `docs/specs/garage/vehicle-insurance-api.md` — `GET/PUT/DELETE /vehicles/:vehicleId/insurance`. All PUT fields optional. Input sanitization at Zod boundary.
- `docs/specs/garage/log-entry-api.md` — `POST/GET/GET/:id/PATCH/DELETE /vehicles/:vehicleId/log`. Full CRUD. Mileage side-effect on create/patch. Items replaced wholesale on PATCH.
- `docs/specs/garage/media-store.md` — Port/Adapter architecture, `MediaStore` interface, `OpfsMediaStore` V1, `CloudMediaStore` V2 plan, React context injection, use cases UC-MEDIA-1 through UC-MEDIA-4.

### ADRs
- `docs/adr/0018-log-entry-data-model.md` — DB lookup tables over Prisma enums for `LogEntryType` and `ItemCategory`.
- `docs/adr/0019-media-store-port-adapter.md` — OPFS + Port/Adapter pattern for client-side media storage.

### Milestones
- `docs/milestones/v1.md` — added Vehicle detail, Log Entry, and MediaStore items to the milestone checklist.

### Design previews
- `docs/designs/revlog-vehicle-detail-preview.html` — vehicle detail screen: hero panel with radial glow + grid texture + motorcycle glyph, stats strip, insurance badge row, service history cards with type color-coding. State switcher: Populated / Empty history / No insurance / Insurance dialog.
- `docs/designs/revlog-log-entry-preview.html` — log entry create/edit form: type pills with hover tooltips, title field, date/time/odometer row, notes textarea, inline-editable items table with category badges and running total, media upload zone with thumbnail grid. State switcher: Create mode / Edit with data / Edit with media / Delete dialog.

---

## Verification performed

- Pre-commit hook (raw token value check) → **passed** on all commits
- Spec and ADR files manually reviewed for consistency with each other (data models, field names, endpoint signatures, enum values all align across the 6 spec files)
- HTML previews opened in browser and all interactive states verified working

---

## Explicitly out of scope (deferred to implementation or V2)

- All implementation (code, migrations, tests) — docs only this session
- Vehicle makes/models/years reference dataset — separate ADR + spec
- Log entry type tooltips as i18n keys (documented as frontend concern, not in DB)
- MediaStore `CloudMediaStore` implementation — V2
- Media compression at upload — V2
- Multi-device media sync — V2
- Video thumbnail/poster-frame generation — V2
- Insurance expiry reminders and price-comparison hooks — post-V1 product feature
