# Vehicle Transfer Spec

**Area:** Garage
**Routes:** `/garage/[vehicleId]` (initiate), `/transfers/[token]` (accept/decline)
**Status:** Not started
**Last updated:** 2026-06-28

---

## Overview

An Owner can transfer a Vehicle and its complete Service History to another Revlog Account. The recipient is identified by email address. If the email belongs to an existing User, their Account is found immediately. If not, an invitation email is sent prompting the recipient to create a Revlog account before accepting.

A Transfer requires explicit acceptance — it is never automatic. The Vehicle is locked (read-only) in the sender's Garage for the duration of the pending Transfer: no log entries can be added, and the Edit Vehicle screen (and its danger zone) is unreachable. The only action available on a locked Vehicle is Cancel transfer. A Transfer expires after 7 days if not acted on.

---

## Use Cases

### UC-VTRANSFER-1 — Owner initiates a vehicle transfer

**Actor:** Owner (sender)
**Precondition:** Owner is authenticated; Vehicle belongs to their Account; no pending Transfer already exists for this Vehicle.
**Milestones:** [V1](../../milestones/v1.md)

1. Owner selects `[Transfer]` on the Vehicle Detail screen (`/garage/[vehicleId]`).
2. System opens the Transfer dialog. Owner enters the recipient's email address.
3. Owner selects `[Send transfer]`.
4. System calls `POST /vehicles/:vehicleId/transfer` with `{ recipientEmail }`.
5. On success:
   - Vehicle is locked in the sender's Garage (read-only; `[✎ Edit]` and `[+ Log entry]` disabled; `[Transfer]` replaced by a "Transfer pending" banner with a `[Cancel transfer]` action).
   - API sends a transfer notification email to the recipient.
6. Dialog closes.

---

### UC-VTRANSFER-2 — Recipient with an existing account accepts the transfer

**Actor:** Owner (recipient)
**Precondition:** Recipient has a verified Revlog account; transfer is in PENDING state and not expired.
**Milestones:** [V1](../../milestones/v1.md)

1. Recipient receives the transfer notification email and selects the link.
2. Link navigates to `/transfers/[token]`.
3. If recipient is not logged in: system redirects to `/login?next=/transfers/[token]`; after login, system redirects back to `/transfers/[token]`.
4. System fetches `GET /transfers/:token` and renders the transfer acceptance screen: Vehicle identity (make, model, year, photo if available), sender display name, expiry date, and `[Accept transfer]` / `[Decline]` actions.
5. Recipient selects `[Accept transfer]`.
6. System calls `POST /transfers/:token/accept`.
7. On 200: Vehicle moves to recipient's Account; screen shows a success state ("Vehicle added to your Garage") with a link to the Vehicle Detail screen.

---

### UC-VTRANSFER-3 — Recipient declines the transfer

**Actor:** Owner (recipient)
**Precondition:** Recipient is on the `/transfers/[token]` screen; transfer is PENDING.
**Milestones:** [V1](../../milestones/v1.md)

1. Recipient selects `[Decline]`.
2. System calls `POST /transfers/:token/decline`.
3. On 200: Transfer status becomes DECLINED; screen shows a confirmation ("Transfer declined").
4. Vehicle is unlocked in the sender's Garage; sender receives a decline notification email.

---

### UC-VTRANSFER-4 — Recipient without an account creates one and accepts

**Actor:** New user (recipient)
**Precondition:** Recipient's email is not registered; transfer is PENDING and not expired.
**Milestones:** [V1](../../milestones/v1.md)

1. Recipient receives the transfer invitation email and selects "Create account & accept".
2. Link navigates to `/register?transferToken=[token]` (token preserved in query string through registration).
3. Recipient completes registration and verifies their email.
4. System redirects to `/transfers/[token]`.
5. Recipient sees the transfer acceptance screen (UC-VTRANSFER-2, step 4 onward) and accepts or declines.

---

### UC-VTRANSFER-5 — Owner cancels a pending transfer

**Actor:** Owner (sender)
**Precondition:** Owner is viewing the locked Vehicle Detail screen; Transfer is PENDING.
**Milestones:** [V1](../../milestones/v1.md)

1. Owner selects `[Cancel transfer]` in the transfer pending banner.
2. System opens a confirmation dialog: "Cancel transfer? The recipient will be notified and the vehicle will be unlocked."
3. Owner confirms.
4. System calls `DELETE /vehicles/:vehicleId/transfer`.
5. On 204: Transfer status becomes CANCELLED; Vehicle is unlocked in the sender's Garage; recipient receives a cancellation email.

---

### UC-VTRANSFER-6 — Transfer expires

**Actor:** System
**Precondition:** Transfer has been PENDING for 7 days with no action.
**Milestones:** [V1](../../milestones/v1.md)

1. A background job (or lazy check on access) detects that `expiresAt` has passed.
2. Transfer status is set to EXPIRED.
3. Vehicle is unlocked in the sender's Garage.
4. Sender receives an expiry notification email.

---

### UC-VTRANSFER-7 — Recipient visits an expired or invalid transfer link

**Actor:** Any user
**Precondition:** Token does not exist, is EXPIRED, CANCELLED, ACCEPTED, or DECLINED.
**Milestones:** [V1](../../milestones/v1.md)

1. User navigates to `/transfers/[token]`.
2. System calls `GET /transfers/:token`.
3. API returns 404 or a resolved status.
4. Screen renders an appropriate message: "This transfer link has expired or is no longer valid." with a link to `/garage` (if logged in) or `/login`.

---

## API Endpoints

### `POST /vehicles/:vehicleId/transfer`

Initiates a Vehicle Transfer.

**Request body:**

| Field | Type | Rules |
|---|---|---|
| `recipientEmail` | string | Required; valid email format; trim + lowercase; max 254 chars |

**Response — 201 Created**

```json
{
  "transfer": {
    "id": "uuid",
    "status": "PENDING",
    "recipientEmail": "buyer@example.com",
    "expiresAt": "2026-07-05T00:00:00.000Z"
  }
}
```

**Error responses:**

| Status | Body | When |
|---|---|---|
| 400 | `{ "error": "Validation error" }` | Invalid or missing recipientEmail |
| 400 | `{ "error": "A pending transfer already exists for this vehicle" }` | Another Transfer is already PENDING |
| 400 | `{ "error": "Cannot transfer to yourself" }` | recipientEmail matches the sender's email |
| 401 | `{ "error": "Unauthorized" }` | Invalid/expired token |
| 403 | `{ "error": "Forbidden" }` | Vehicle belongs to a different Account |
| 404 | `{ "error": "Vehicle not found" }` | No Vehicle with this ID |

---

### `GET /transfers/:token`

Fetches transfer details for the acceptance screen. Public endpoint — no auth required (the token is the credential).

**Response — 200 OK**

```json
{
  "transfer": {
    "status": "PENDING",
    "expiresAt": "2026-07-05T00:00:00.000Z",
    "vehicle": {
      "make": "Honda",
      "model": "CB650R",
      "year": 2019,
      "nickname": "Blackbird",
      "photoUrl": "/uploads/vehicles/abc123.jpg | null",
      "logEntryCount": 14
    },
    "senderName": "Alex Morgan"
  }
}
```

**Error responses:**

| Status | Body | When |
|---|---|---|
| 404 | `{ "error": "Transfer not found or no longer valid" }` | Token does not exist, or status is not PENDING, or transfer is expired |

---

### `POST /transfers/:token/accept`

Accepts the transfer. Requires authentication (recipient must be logged in).

**Response — 200 OK**

```json
{
  "vehicleId": "uuid"
}
```

**Error responses:**

| Status | Body | When |
|---|---|---|
| 401 | `{ "error": "Unauthorized" }` | Not authenticated |
| 404 | `{ "error": "Transfer not found or no longer valid" }` | Token not found or not PENDING |
| 409 | `{ "error": "Transfer already resolved" }` | Status is not PENDING |

---

### `POST /transfers/:token/decline`

Declines the transfer. Public endpoint — token is the credential; no account needed.

**Response — 204 No Content**

**Error responses:**

| Status | Body | When |
|---|---|---|
| 404 | `{ "error": "Transfer not found or no longer valid" }` | Token not found or not PENDING |

---

### `DELETE /vehicles/:vehicleId/transfer`

Cancels the pending transfer (sender only).

**Response — 204 No Content**

**Error responses:**

| Status | Body | When |
|---|---|---|
| 401 | `{ "error": "Unauthorized" }` | Not authenticated |
| 403 | `{ "error": "Forbidden" }` | Vehicle belongs to a different Account |
| 404 | `{ "error": "No pending transfer for this vehicle" }` | Vehicle has no PENDING Transfer |

---

### Three-layer responsibilities (shared)

**Routes** (`apps/api/src/routes/vehicles.ts`, `apps/api/src/routes/transfers.ts`):
- Validate request body / path params
- Call the appropriate service method
- Map result to HTTP response; pass errors to `next(err)`

**Service** (`apps/api/src/services/VehicleTransferService.ts`):
- Owns all transfer business logic: ownership checks, status guard clauses, email dispatch
- On initiate: resolve recipient Account (or mark as unregistered); create Transfer record; send email
- On accept: verify PENDING status; move `vehicle.accountId` to recipient Account; update Transfer status; send confirmation emails
- On decline/cancel: update Transfer status; send notification emails
- Expiry: lazy-check on `GET /transfers/:token` — if `expiresAt < now` and status is PENDING, set EXPIRED before returning 404

**Repository** (`apps/api/src/repositories/VehicleTransferRepository.ts`):
- CRUD on `VehicleTransfer`
- `findByToken(token)`, `findPendingByVehicleId(vehicleId)`, `updateStatus(id, status)`
- Vehicle ownership change: `prisma.vehicle.update({ where: { id }, data: { accountId: recipientAccountId } })`

---

## Schema changes

### `VehicleTransfer` model (new migration)

```prisma
enum VehicleTransferStatus {
  PENDING
  ACCEPTED
  DECLINED
  CANCELLED
  EXPIRED
}

model VehicleTransfer {
  id             String                @id @default(uuid())
  vehicleId      String
  vehicle        Vehicle               @relation(fields: [vehicleId], references: [id], onDelete: Cascade)
  senderAccountId String
  recipientEmail String
  recipientAccountId String?           // null until a matching Account is found or created
  token          String                @unique @default(uuid())
  status         VehicleTransferStatus @default(PENDING)
  expiresAt      DateTime
  createdAt      DateTime              @default(now())
  updatedAt      DateTime              @updatedAt

  @@index([vehicleId])
  @@index([token])
}
```

`Vehicle` model gets a back-relation: `transfers VehicleTransfer[]`

The `isTransferPending` state is derived: `VehicleTransfer` with `vehicleId = x` and `status = PENDING` and `expiresAt > now`. The existing `GET /vehicles/:vehicleId` response should include a `transferPending` boolean so the frontend can render the locked state.

---

## Email templates

### Transfer notification (existing account recipient)

**Subject:** [Sender name] wants to transfer [Vehicle display name] to you

**Content:**
- Sender name + vehicle identity (make, model, year, photo if available)
- "Accept or decline — this transfer expires in 7 days."
- Primary CTA: `[Review transfer]` → `/transfers/[token]`

Design file: [`revlog-transfer-existing-user-email-template.html`](../../designs/revlog-transfer-existing-user-email-template.html)

### Transfer invitation (new user recipient)

**Subject:** You've been invited to receive a vehicle on Revlog

**Content:**
- Sender name + vehicle identity
- "Create your Revlog account to accept or decline this transfer."
- Primary CTA: `[Create account & review transfer]` → `/register?transferToken=[token]`

Design file: [`revlog-transfer-invite-email-template.html`](../../designs/revlog-transfer-invite-email-template.html)

### Transfer cancellation (recipient)

**Subject:** [Sender name] cancelled the vehicle transfer

**Content:** Brief notice that the transfer was cancelled; no action required.

### Transfer decline notification (sender)

**Subject:** Your transfer of [Vehicle display name] was declined

**Content:** Brief notice; vehicle is back in their Garage.

### Transfer expiry notification (sender)

**Subject:** Your transfer of [Vehicle display name] has expired

**Content:** Transfer expired without a response; vehicle is back in their Garage.

---

## `/transfers/[token]` Screen

### Layout

- Revlog wordmark at top (centred; not sticky)
- Card showing:
  - Vehicle photo (or glyph if no photo)
  - Vehicle display name + "Make · Model · Year"
  - Log entry count ("14 log entries included")
  - Sender name: "From [Name]"
  - Expiry: "Expires [date]"
- Two actions: `[Accept transfer]` (primary) · `[Decline]` (ghost/destructive)
- Accept requires authentication; if not logged in, clicking `[Accept transfer]` redirects to `/login?next=/transfers/[token]`
- Decline does not require authentication

### States

| State | Description |
|---|---|
| PENDING (logged out) | Accept button redirects to login; Decline available |
| PENDING (logged in) | Both actions available |
| Post-accept | Success message: "Blackbird has been added to your Garage" + link to `/garage/[vehicleId]` |
| Post-decline | Confirmation: "Transfer declined" |
| Expired / invalid | "This transfer link is no longer valid" |
| Loading | Skeleton while `GET /transfers/:token` is in flight |

Design file: [`revlog-vehicle-transfer-accept-preview.html`](../../designs/revlog-vehicle-transfer-accept-preview.html)

---

## Vehicle Detail screen — locked state

When `transferPending: true` is returned by `GET /vehicles/:vehicleId`:

- `[✎ Edit]` and `[+ Log entry]` buttons are removed from the top bar
- `[Transfer]` button is removed
- A full-width banner renders below the top bar (above the hero): "Transfer pending · Sent to [recipientEmail] · Expires [date]" with a `[Cancel transfer]` action
- All Log Entry cards are non-interactive (no navigation link)
- Insurance dialog: read-only, edit button removed

Design file: [`revlog-vehicle-detail-updated-preview.html`](../../designs/revlog-vehicle-detail-updated-preview.html)

---

## Acceptance Criteria

### Initiate transfer

- [ ] `[Transfer]` button on Vehicle Detail opens the Transfer dialog
- [ ] Dialog validates email format before enabling `[Send transfer]`
- [ ] `POST /vehicles/:vehicleId/transfer` creates a VehicleTransfer in PENDING state
- [ ] Vehicle Detail screen shows the transfer pending banner after initiation
- [ ] `[✎ Edit]`, `[+ Log entry]`, and `[Transfer]` are removed from the top bar while pending
- [ ] Initiating a transfer when one already exists returns 400
- [ ] Sending to own email returns 400

### Accept (existing account)

- [ ] `/transfers/[token]` renders vehicle info, sender name, and expiry
- [ ] Unauthenticated visitor clicking Accept is redirected to login, then back to `/transfers/[token]`
- [ ] `POST /transfers/:token/accept` moves `vehicle.accountId` to recipient's Account
- [ ] Accepted vehicle appears in recipient's Garage
- [ ] Accepted vehicle disappears from sender's Garage
- [ ] Success state shown after acceptance with link to vehicle detail

### Accept (new user)

- [ ] Invitation email contains a link to `/register?transferToken=[token]`
- [ ] After registration + email verification, redirect to `/transfers/[token]`
- [ ] New user can accept or decline from `/transfers/[token]`

### Decline

- [ ] `POST /transfers/:token/decline` sets status to DECLINED
- [ ] Vehicle is unlocked in sender's Garage after decline
- [ ] Decline does not require authentication
- [ ] Sender receives a decline notification email

### Cancel

- [ ] `[Cancel transfer]` on the pending banner opens a confirmation dialog
- [ ] `DELETE /vehicles/:vehicleId/transfer` sets status to CANCELLED
- [ ] Vehicle is unlocked in sender's Garage after cancellation
- [ ] Recipient receives a cancellation email

### Expiry

- [ ] A VehicleTransfer with `expiresAt` in the past is treated as EXPIRED on lazy access
- [ ] `/transfers/[token]` returns 404 for an expired transfer
- [ ] Expired transfer renders the "no longer valid" state
- [ ] Vehicle is unlocked in sender's Garage once expired
- [ ] Sender receives an expiry notification email

### Unit tests

- [ ] Service: happy path initiate — Transfer created, email sent
- [ ] Service: duplicate pending transfer returns 400
- [ ] Service: transfer to self returns 400
- [ ] Service: accept — vehicle accountId updated, emails sent
- [ ] Service: accept on non-PENDING transfer returns 409
- [ ] Service: decline — status updated, sender notified
- [ ] Service: cancel — status updated, recipient notified
- [ ] Service: expired transfer lazy-set to EXPIRED on access

### E2E

- [ ] Full sender → recipient (existing account) accept flow
- [ ] Full sender → recipient (new account) register → accept flow
- [ ] Sender cancels pending transfer; vehicle unlocked
- [ ] Recipient declines; vehicle unlocked

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Acceptance required for all recipients | Transfer always goes through PENDING → ACCEPTED/DECLINED/EXPIRED/CANCELLED | Even existing account holders should explicitly choose to receive a vehicle; auto-accept could result in unwanted vehicles appearing in a Garage |
| 7-day expiry | `expiresAt = createdAt + 7 days` | Long enough for the recipient to act; short enough to avoid indefinite locks on the sender's vehicle |
| Vehicle locked (read-only) during pending | `[✎ Edit]` and `[+ Log entry]` removed; only Cancel transfer available | Prevents the sender from modifying or adding entries to a vehicle whose future ownership is uncertain |
| Decline without account | `POST /transfers/:token/decline` is unauthenticated | Forcing account creation just to say "no" is hostile UX. The token is sufficient credential for a decline |
| New user: register then accept | Explicit accept/decline screen after registration, not auto-accept on signup | The new user may reconsider; coupling account creation to vehicle acceptance conflates two separate domain events |
| Lazy expiry check | Status set to EXPIRED on first access after `expiresAt`, not by a scheduled job | Simpler to ship in V1; a background job can be added in V2 if timely sender notification becomes important |
| Token = UUID | Separate `token` field (UUID), not the Transfer `id` | Allows token rotation/revocation without changing the Transfer record's primary key |

---

## Out of scope

- Transfer to an unregistered email with no Revlog invitation → not planned (invitation is always sent)
- Multiple simultaneous pending transfers for the same vehicle → blocked by the "one pending transfer" guard
- Transfer history / audit log → V2
- Organisational Account transfers (multiple users per Account) → requires V2 Account model
