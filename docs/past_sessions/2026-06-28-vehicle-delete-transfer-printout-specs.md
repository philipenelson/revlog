# Session: Delete vehicle, vehicle transfer, and mechanic printout — specs and design previews

**Date:** 2026-06-28
**Branch/worktree:** `worktree-fizzy-popping-badger`

---

## Goal

Design and fully document three new V1 features through the `/grill-with-docs` interview process, then produce all required specs, milestone updates, domain glossary changes, and interactive HTML design previews — before any implementation begins.

The three features:
1. **Delete a vehicle** — permanent removal from the Edit Vehicle screen
2. **Vehicle Transfer** — send a vehicle and its complete service history to another account
3. **Mechanic Printout** — token-gated public HTML page of a vehicle's service history, shareable via link or email

---

## Key decisions

- **Hard delete, not soft delete** — `DELETE /vehicles/:vehicleId` removes the vehicle and all child records (log entries, items, media, insurance) via Prisma cascade (`onDelete: Cascade`). Soft delete was rejected: no recovery path in V1, and it adds filter complexity to every query.

- **Delete entry point: Edit Vehicle danger zone, not Vehicle Detail** — a "Danger zone" section at the bottom of the Edit screen keeps the destructive action behind one extra navigation step. The Vehicle Detail screen stays clean.

- **Transfer targets an Account, not a User** — vehicles belong to Accounts, so the transfer model correctly names `senderAccountId` / `recipientAccountId`. If the recipient email has no account, they receive an invite email to create one first.

- **New-user transfer flow** — invite email links to `/register?transferToken=[token]`. After email verification the user lands on `/transfers/[token]` to accept or decline. New users do not need an account to decline; ignoring the email is sufficient.

- **Transfer expires after 7 days (lazy)** — no background job. The service checks `expiresAt < now()` on every status read and marks the record `EXPIRED` at that point. Status is surfaced to the sender via `GET /vehicles/:vehicleId` returning `transferPending: boolean`.

- **Vehicle locked read-only during a pending transfer** — Edit Vehicle is unreachable, so the delete button is inherently inaccessible; no extra guard required. The only action available to the sender is Cancel transfer. Log entry cards render non-interactive. `[Share report]` is also disabled during a pending transfer.

- **Mechanic Printout is a V1 feature pulled forward** — previously the term existed in CONTEXT.md as a V2 concept ("A PDF export"). In V1 it is a printable HTML page at a token-gated public URL (`/report/[shareToken]`); no PDF generation. V2 adds: PDF snapshot generated at share time (so the recipient sees point-in-time data, not live data) and selective content export.

- **One active share token per vehicle, revocable** — `VehicleReportToken` has `vehicleId @unique`. Revoking deletes the record; generating a new link replaces the old one. No token expiry in V1.

- **Email delivers a link, not a file** — `POST /vehicles/:vehicleId/report-token/email` sends a link to the public printout page. The recipient can use browser print-to-PDF. V2 will attach a generated PDF.

- **CONTEXT.md is a domain glossary only** — no process, state machines, or implementation details belong there. The Vehicle Transfer entry was rewritten from a detailed description (including states, lock behaviour, expiry) to a single sentence: "The reassignment of a Vehicle and its complete Service History from one Account to another, subject to acceptance by the recipient."

- **New features get their own spec file** — adding use cases to `edit-vehicle.md` was rejected in favour of a standalone `delete-vehicle.md` following the full spec format: overview, use cases, API, domain changes, acceptance criteria, decisions, out of scope.

- **Mobile app is V1** — during milestone cleanup, mobile was confirmed as a V1 deliverable that must ship before V1 goes live. It was moved from a deferred note to a proper `## Mobile` checklist item in `v1.md`.

---

## What was documented (14 files, 1 commit — e7f553b)

### Specs — new (3 files)
- `docs/specs/garage/delete-vehicle.md` — UC-VDELETE-1 (confirm and delete), UC-VDELETE-2 (cancel dialog); `DELETE /vehicles/:vehicleId` (204); three-layer responsibilities; danger zone layout; `IVehicleRepository.delete` interface; acceptance criteria; hard delete rationale.
- `docs/specs/garage/vehicle-transfer.md` — 7 use cases (initiate, accept existing user, decline, accept new user, cancel, lazy expiry, invalid/expired link); 5 API endpoints; `VehicleTransfer` Prisma model with `VehicleTransferStatus` enum; locked-state spec; email template references.
- `docs/specs/garage/mechanic-printout.md` — 5 use cases (generate link, email link, revoke, view printout, invalid link); 4 API endpoints; `VehicleReportToken` Prisma model; share dialog states (no token / token active); printout layout; print CSS (`@media print`, A4, `break-inside: avoid`); V2 deferred items.

### Specs — updated (2 files)
- `docs/specs/garage/vehicle-detail-screen.md` — top bar updated to include `[Share report]`, `[Transfer]`, and locked state; next steps and out-of-scope updated to reference new specs.
- `docs/specs/garage/edit-vehicle.md` — stale out-of-scope line removed ("Vehicle archiving / soft-delete — separate V2 feature"); Related specs section added pointing to `delete-vehicle.md`.

### Milestones (2 files)
- `docs/milestones/v1.md` — three new vehicle checklist items (delete, transfer, mechanic printout); "Not in V1" section replaced with "Deferred" + pointer to `v2.md`; `## Mobile` section added with `- [ ] Mobile app (React Native / Expo)`.
- `docs/milestones/v2.md` — Mechanic Printout V2 scope clarified (PDF snapshot at share time + selective content export); Mobile section removed (now V1).

### Domain glossary (1 file)
- `CONTEXT.md` — Vehicle Transfer term added (one sentence, glossary-only); Mechanic Printout definition updated from "A PDF export…" to "A formatted export of a vehicle's Service History for sharing with a workshop or prospective buyer."

### Design previews — new (6 files)
- `docs/designs/revlog-vehicle-detail-updated-preview.html` — updated Vehicle Detail with Transfer + Share Report buttons in the top bar; locked/transfer-pending state with banner and disabled controls; Share Report dialog (no-token and token-active states); Transfer dialog (email input + send). 5-state switcher.
- `docs/designs/revlog-edit-vehicle-with-delete-preview.html` — Edit Vehicle form with Danger zone at bottom; delete confirmation dialog (red icon, destructive button). 2-state switcher.
- `docs/designs/revlog-vehicle-transfer-accept-preview.html` — standalone `/transfers/[token]` page; transfer card with vehicle mini-hero, metadata rows, Accept + Decline actions; resolved states (accepted, declined, expired/invalid). 5-state switcher (pending logged out, pending logged in, accepted, declined, expired).
- `docs/designs/revlog-mechanic-printout-preview.html` — public `/report/[shareToken]` page; dark screen mode with sticky print button; light mode matching browser print output; A4-optimised service history with type badges, items tables, notes; revoked state. 3-state switcher.
- `docs/designs/revlog-transfer-email-template.html` — MSO-compatible HTML email; two variants (existing user transfer notification + new user invite with `/register?transferToken=…` CTA); 2-state switcher.
- `docs/designs/revlog-mechanic-printout-email-template.html` — MSO-compatible HTML email; share email delivering report link to recipient with "View service history" CTA; no account required note.

---

## Verification performed

- Pre-commit hook (raw token value scan) → **passed** on e7f553b
- All 6 HTML design files opened and interactive states verified
- Spec cross-references checked: API endpoint signatures, Prisma model field names, and email template references align across `vehicle-transfer.md`, `mechanic-printout.md`, and their design files

---

## Explicitly out of scope (deferred or not in scope)

- All implementation (routes, services, Prisma migrations, React screens, tests) — docs only this session
- PDF generation at share time — V2 Mechanic Printout
- Selective content export — V2 Mechanic Printout
- Multiple active share tokens per vehicle — V2
- Share token expiry — V2
- PDF email attachment — V2 (V1 sends link only)
- Transfer decline without an account via a dedicated public decline URL — declined users can ignore the email; a decline option is available post-registration
- Push / in-app notifications for transfer events — post-V1
- Insurance data in the Mechanic Printout — explicitly excluded; service history only
