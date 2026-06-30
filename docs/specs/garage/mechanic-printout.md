# Mechanic Printout Spec

**Area:** Garage / Exports
**Routes:** `/garage/[vehicleId]` (share action), `/report/[shareToken]` (public printout)
**Status:** Not started
**Last updated:** 2026-06-28

---

## Overview

The Mechanic Printout is a formatted export of a Vehicle's Service History for sharing with a workshop or prospective buyer. In V1, it is delivered as a printable HTML page at a token-gated public URL. The recipient needs no Revlog account.

The Owner generates a shareable link from the Vehicle Detail screen. Each Vehicle has at most one active share token at a time. The Owner can revoke it (destroying the link) and generate a new one at any time. The Owner can optionally send the link via email to one address directly from the share dialog.

The printout page is public — the share token is the credential — and is optimised for browser print-to-PDF.

---

## Use Cases

### UC-PRINTOUT-1 — Owner generates a share link

**Actor:** Owner
**Precondition:** Owner is authenticated; Vehicle belongs to their Account; no Transfer is pending for this Vehicle.
**Milestones:** [V1](../../milestones/v1.md)

1. Owner selects `[Share report]` on the Vehicle Detail screen.
2. System opens the Share Report dialog.
3. If no active token exists: Owner selects `[Generate link]`.
   - System calls `POST /vehicles/:vehicleId/report-token`.
   - Dialog shows the generated URL with a `[Copy link]` button.
4. If an active token already exists: dialog shows the current URL with `[Copy link]` and `[Revoke]`.

---

### UC-PRINTOUT-2 — Owner emails the share link

**Actor:** Owner
**Precondition:** Share dialog is open; a link has been generated.
**Milestones:** [V1](../../milestones/v1.md)

1. Owner enters one email address in the "Send to" field and selects `[Send]`.
2. System calls `POST /vehicles/:vehicleId/report-token/email` with `{ email }`.
3. On success: dialog shows a brief confirmation ("Sent to [email]"); email field is cleared.

---

### UC-PRINTOUT-3 — Owner revokes the share link

**Actor:** Owner
**Precondition:** Share dialog is open; an active token exists.
**Milestones:** [V1](../../milestones/v1.md)

1. Owner selects `[Revoke]` in the Share Report dialog.
2. System calls `DELETE /vehicles/:vehicleId/report-token`.
3. On 204: token is destroyed; any existing link to `/report/[shareToken]` now returns 404.
4. Dialog returns to the "Generate link" state.

---

### UC-PRINTOUT-4 — Recipient views the Mechanic Printout

**Actor:** Any person with the share link (no account required)
**Precondition:** Token exists and has not been revoked.
**Milestones:** [V1](../../milestones/v1.md)

1. Recipient opens `/report/[shareToken]` in a browser.
2. System calls `GET /report/:shareToken` (public, unauthenticated).
3. Page renders: Vehicle identity, photo (if set), stats, and complete Service History.
4. Recipient uses browser `Ctrl/Cmd + P` to print or save as PDF.

---

### UC-PRINTOUT-5 — Recipient visits a revoked or invalid link

**Actor:** Any person with the share link
**Precondition:** Token does not exist (never created or revoked).
**Milestones:** [V1](../../milestones/v1.md)

1. Recipient opens `/report/[shareToken]`.
2. `GET /report/:shareToken` returns 404.
3. Page renders: "This report is no longer available."

---

## API Endpoints

### `POST /vehicles/:vehicleId/report-token`

Creates or replaces the active share token for a Vehicle. If one exists it is replaced (old link immediately invalidated).

**Request body:** None.

**Response — 201 Created**

```json
{
  "shareToken": "uuid",
  "shareUrl": "https://app.revlog.io/report/[shareToken]"
}
```

**Error responses:**

| Status | Body | When |
|---|---|---|
| 401 | `{ "error": "Unauthorized" }` | Not authenticated |
| 403 | `{ "error": "Forbidden" }` | Vehicle belongs to a different Account |
| 404 | `{ "error": "Vehicle not found" }` | No Vehicle with this ID |

---

### `DELETE /vehicles/:vehicleId/report-token`

Revokes the active share token for a Vehicle.

**Response — 204 No Content**

**Error responses:**

| Status | Body | When |
|---|---|---|
| 401 | `{ "error": "Unauthorized" }` | Not authenticated |
| 403 | `{ "error": "Forbidden" }` | Vehicle belongs to a different Account |
| 404 | `{ "error": "No active share token for this vehicle" }` | No token to revoke |

---

### `POST /vehicles/:vehicleId/report-token/email`

Sends the share link to one email address.

**Request body:**

| Field | Type | Rules |
|---|---|---|
| `email` | string | Required; valid email; trim + lowercase; max 254 chars |

**Response — 204 No Content**

**Error responses:**

| Status | Body | When |
|---|---|---|
| 400 | `{ "error": "Validation error" }` | Invalid email |
| 401 | `{ "error": "Unauthorized" }` | Not authenticated |
| 403 | `{ "error": "Forbidden" }` | Vehicle belongs to a different Account |
| 404 | `{ "error": "No active share token for this vehicle" }` | Token must exist before emailing |

---

### `GET /report/:shareToken`

Returns the data needed to render the public Mechanic Printout. No authentication required.

**Response — 200 OK**

```json
{
  "vehicle": {
    "nickname": "Blackbird | null",
    "make": "Honda",
    "model": "CB650R",
    "year": 2019,
    "mileage": 12500,
    "photoUrl": "/uploads/vehicles/abc123.jpg | null"
  },
  "stats": {
    "logEntryCount": 14,
    "lastLoggedAt": "2025-06-03",
    "totalSpent": "1840.00"
  },
  "logEntries": [
    {
      "id": "uuid",
      "typeId": "MAINTENANCE",
      "title": "Oil & filter change",
      "date": "2025-06-03",
      "mileage": 12400,
      "notes": "Full synthetic 10W-40.",
      "items": [
        {
          "categoryId": "PARTS",
          "description": "Oil filter",
          "quantity": "1.000",
          "unitCost": "12.00"
        }
      ]
    }
  ]
}
```

**Error responses:**

| Status | Body | When |
|---|---|---|
| 404 | `{ "error": "Report not found" }` | Token does not exist or has been revoked |

---

### Three-layer responsibilities

**Route** (`apps/api/src/routes/report.ts` for the public endpoint; vehicles router for token management):
- `GET /report/:shareToken` — no auth middleware; call `reportService.getByShareToken(token)`, return 404 if null
- Token management routes — protected by auth middleware; validate ownership

**Service** (`apps/api/src/services/VehicleReportService.ts`):
- `createToken(vehicleId, accountId)` — ownership check, upsert `VehicleReportToken`, return token
- `revokeToken(vehicleId, accountId)` — ownership check, delete `VehicleReportToken`
- `emailLink(vehicleId, accountId, email)` — ownership check, verify token exists, send email via `emailService`
- `getByShareToken(token)` — fetch `VehicleReportToken` → `Vehicle` with all `LogEntry` + `LogItem` aggregates; return null if not found

**Repository** (`apps/api/src/repositories/VehicleReportTokenRepository.ts`):
- `upsertByVehicleId(vehicleId, token)`, `deleteByVehicleId(vehicleId)`, `findByToken(token)`

---

## Schema changes

### `VehicleReportToken` model (new migration)

```prisma
model VehicleReportToken {
  id        String   @id @default(uuid())
  vehicleId String   @unique
  vehicle   Vehicle  @relation(fields: [vehicleId], references: [id], onDelete: Cascade)
  token     String   @unique @default(uuid())
  createdAt DateTime @default(now())

  @@index([token])
}
```

One row per Vehicle. `@unique` on `vehicleId` enforces the one-token-per-vehicle rule at the DB level. Revoking is a `DELETE`; regenerating is a `DELETE` + `INSERT` (or upsert). `onDelete: Cascade` cleans up the token if the Vehicle is deleted.

---

## `/report/[shareToken]` Page — Printout Layout

The printout page uses a light theme and print-optimised CSS. It is not part of the Next.js authenticated app shell — it is a standalone public page (Next.js route outside the authenticated layout).

### Sections (in order)

1. **Header** — Revlog wordmark (small, top-left) + "Vehicle Service History" label + generated date ("Report generated Jun 28 2026")
2. **Vehicle identity** — Photo (if set; full-width); Make · Model · Year · Nickname (if set); current mileage
3. **Stats row** — Log entries count · Last logged date · Total spent
4. **Service History** — All Log Entries, newest-first, each showing:
   - Type label + date + mileage at entry
   - Entry title (bold)
   - Items table: description, quantity, unit cost, line total
   - Notes (if present)
5. **Footer** — "Generated by Revlog · revlog.io" + generation date

### Print styles

- `@media print` removes the header wordmark area and collapses page margins
- Each Log Entry avoids page breaks mid-card (`break-inside: avoid`)
- Page size: A4

Design file: [`revlog-mechanic-printout-preview.html`](../../designs/revlog-mechanic-printout-preview.html)

---

## Share Report dialog — Vehicle Detail screen

A new `[Share report]` button is added to the Vehicle Detail top bar alongside `[✎ Edit]` and `[+ Log entry]`. The button is disabled when a Vehicle Transfer is pending.

### Dialog states

| State | Content |
|---|---|
| No active token | Introductory copy + `[Generate link]` button |
| Token active | Link URL + `[Copy link]` · Send-to email field + `[Send]` · `[Revoke]` (destructive, secondary) |
| Link copied | Brief "Copied!" confirmation next to copy button |
| Email sent | "Sent to [email]" confirmation; email field cleared |

Design file: [`revlog-vehicle-detail-updated-preview.html`](../../designs/revlog-vehicle-detail-updated-preview.html)

---

## Email template

**Subject:** [Owner name] shared a vehicle service history with you

**Content:**
- Vehicle identity (make, model, year, photo if available)
- Owner name: "Shared by [Name]"
- Primary CTA: `[View service history]` → `/report/[shareToken]`
- Note: "Use your browser's print function to save as PDF."

Design file: [`revlog-mechanic-printout-email-template.html`](../../designs/revlog-mechanic-printout-email-template.html)

---

## Acceptance Criteria

### Token management

- [ ] `POST /vehicles/:vehicleId/report-token` creates a token and returns a URL
- [ ] Calling it again replaces the old token (old URL now 404s)
- [ ] `DELETE /vehicles/:vehicleId/report-token` removes the token; the URL returns 404
- [ ] Token management endpoints reject unauthenticated requests (401)
- [ ] Token management endpoints reject requests for vehicles belonging to other accounts (403)

### Email

- [ ] `POST /vehicles/:vehicleId/report-token/email` sends an email to the provided address
- [ ] Returns 404 if no active token exists for the vehicle
- [ ] Email contains a working link to `/report/[shareToken]`

### Printout page

- [ ] `GET /report/:shareToken` returns vehicle identity, stats, and all log entries with items
- [ ] Page renders vehicle photo when `photoUrl` is set; renders "no photo" placeholder when not
- [ ] Stats row shows entry count, last logged date, and total spent
- [ ] Each log entry shows type, title, date, mileage, items table, and notes
- [ ] Entries are ordered newest-first
- [ ] Revoking the token causes the page to render the "no longer available" state
- [ ] Browser print produces a clean A4 layout (manual verification)
- [ ] Page renders correctly without authentication

### Vehicle Detail screen

- [ ] `[Share report]` button appears in the top bar
- [ ] Dialog opens with "Generate link" state when no token exists
- [ ] After generation, dialog shows the URL, Copy, Send, and Revoke actions
- [ ] Copy button copies URL to clipboard; "Copied!" confirmation appears
- [ ] Send button sends email; "Sent" confirmation appears; field clears
- [ ] Revoke removes the token; dialog returns to "Generate link" state
- [ ] `[Share report]` button is disabled when a Vehicle Transfer is pending

### Unit tests

- [ ] Service: createToken — token created, URL returned
- [ ] Service: createToken called twice — old token replaced
- [ ] Service: revokeToken — token deleted
- [ ] Service: revokeToken when no token exists — 404
- [ ] Service: emailLink — email sent with correct URL
- [ ] Service: emailLink when no token exists — 404
- [ ] Service: getByShareToken — returns full vehicle + log entry data
- [ ] Service: getByShareToken with unknown token — returns null

### E2E

- [ ] Generate link → copy → visit URL → printout renders
- [ ] Revoke → visit old URL → "no longer available" state
- [ ] Generate link → email → link works

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Token-gated public URL | `VehicleReportToken` with UUID token; no authentication on `GET /report/:token` | Mechanic or buyer has no Revlog account; UUID is sufficient credential for a low-sensitivity read-only page |
| One active token per vehicle | `@unique vehicleId` on `VehicleReportToken` | Simplifies the share dialog (no list of links to manage); revoke + regenerate achieves link rotation |
| No token expiry in V1 | Token lives until explicitly revoked | Owner controls the link lifetime; expiry adds UX complexity for a V1 feature. V2 can add configurable expiry |
| Printable HTML, not server-generated PDF | Browser print-to-PDF via `@media print` | No server-side PDF library needed in V1 (avoids puppeteer/headless Chrome complexity); modern browsers produce high-quality PDFs from print CSS |
| Email sends link, not attachment | `POST /vehicles/:vehicleId/report-token/email` emails the URL | Simpler than generating a PDF server-side; consistent with V1 delivery method. V2 upgrades to PDF attachment |
| Share disabled during pending transfer | `[Share report]` disabled when `transferPending: true` | Sharing a vehicle whose ownership is in dispute is confusing; the recipient of the report might be the same person as the transfer recipient |

---

## Out of scope

- PDF snapshot generated at share time (point-in-time freeze) → V2
- Selective content export (choose log entries or fields to include) → V2
- Token expiry / configurable link lifetime → V2
- Multiple simultaneous share links → V2
- Analytics (view count, last viewed) → V2
