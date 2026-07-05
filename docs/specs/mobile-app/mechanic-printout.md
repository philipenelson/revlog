# Mobile Mechanic Printout Spec

**Area:** Mobile / Exports
**Status:** Implemented
**Last updated:** 2026-07-05

---

## Overview

The Mechanic Printout on mobile covers generating a share token and sharing the link via the native OS share sheet. Token management (generate, revoke) uses the same API as the web spec (`docs/specs/garage/mechanic-printout.md`). The key mobile difference: sharing uses React Native's `Share.share()` instead of a copy-link dialog and custom email form. The OS share sheet handles all delivery methods (WhatsApp, Messages, Mail, AirDrop, copy link, etc.) natively.

This is an **online-only** feature — the report token is a transient server resource, never persisted to local SQLite. The screen fetches the current token on open (`GET /vehicles/:vehicleId/report-token`) and generates/revokes with direct online calls, mirroring the web `useShareReportViewModel`. There is no offline mode: a token can't be generated, revoked, or shared without connectivity, and open should always reflect server truth (the token may have been revoked from another device).

The public printout page (`/report/[shareToken]`) is rendered by the web app in a browser — mobile does not render it natively.

Design file: [`revlog-mobile-mechanic-printout.html`](../../designs/mobile/revlog-mobile-mechanic-printout.html)

---

## Use Cases

### UC-MOB-PRINT-1 — Owner generates a share link

**Actor:** Owner
**Precondition:** Owner is on Vehicle Detail; no pending transfer for this Vehicle.
**Milestones:** [V1](../../milestones/v1.md)

1. Owner taps `[Share report]` on Vehicle Detail.
2. App navigates to the Mechanic Printout screen.
3. On open, the screen fetches current token state (`GET /vehicles/:vehicleId/report-token`). If no active token exists it shows the `[Generate link]` button.
4. Owner taps `[Generate link]`.
5. App calls `POST /vehicles/:vehicleId/report-token` directly via `tokenHttpClient` (online-only, mirroring the web viewmodel).
6. On success: screen shows the generated URL and `[Share]` + `[Revoke]` buttons.

---

### UC-MOB-PRINT-2 — Owner shares the report via OS share sheet

**Actor:** Owner
**Precondition:** UC-MOB-PRINT-1 completed; active share token exists.
**Milestones:** [V1](../../milestones/v1.md)

1. Owner taps `[Share]`.
2. App calls `Share.share({ url: shareUrl, message: 'My vehicle service history on Revlog' })`.
3. OS share sheet appears. Owner selects their preferred channel (Messages, WhatsApp, Mail, AirDrop, copy link, etc.).
4. Recipient receives the link. Tapping it opens the printout page (`/report/[shareToken]`) in a browser.

---

### UC-MOB-PRINT-3 — Owner revokes the share link

**Actor:** Owner
**Precondition:** Active share token exists; Owner is on the Mechanic Printout screen.
**Milestones:** [V1](../../milestones/v1.md)

1. Owner taps `[Revoke]`.
2. App shows confirmation: "Revoke this link? Anyone with the current link will no longer be able to view the report."
3. Owner confirms.
4. App calls `DELETE /vehicles/:vehicleId/report-token`.
5. On success: screen returns to the "Generate link" state.

---

## Acceptance Criteria

- [x] `[Share report]` button is disabled when a Vehicle Transfer is pending
- [x] On open, the screen fetches current token state and shows Generate vs Share/Revoke accordingly
- [x] `[Generate link]` calls `POST /vehicles/:vehicleId/report-token` and shows the result URL
- [x] `[Share]` opens the OS native share sheet with the share URL
- [x] `[Revoke]` shows a confirmation dialog before calling `DELETE /vehicles/:vehicleId/report-token`
- [x] After revoke, screen returns to the "Generate link" state
- [x] A network failure on fetch, generate, or revoke surfaces an error state rather than crashing

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Native share sheet | `Share.share()` from React Native core | No extra package; covers all delivery methods the OS supports; far better UX than a copy-link dialog + email form |
| No custom email form | OS share sheet handles email | The web's email form exists because browsers cannot trigger the system share sheet; mobile has no such constraint |
| Online-only token operations | Generate and revoke require connectivity; called directly via `tokenHttpClient` | Token lifecycle is server-authoritative; cannot be queued in the outbox (the URL cannot be known until the server responds). Mirrors the web viewmodel and the existing mobile auth viewmodels — see `apps/mobile/CLAUDE.md`'s online-only exception |
| No local caching | Fetch current token on open; never persisted to SQLite | A cached token can't be used offline anyway, and open should reflect server truth (the token may have been revoked from another device). Caching would cost a migration + columns + repository methods to save a single GET |

---

## Out of scope

- In-app printout rendering (native) → the public URL opens in the browser
- PDF generation → V2 (same as web V2)
- Selective content export → V2
