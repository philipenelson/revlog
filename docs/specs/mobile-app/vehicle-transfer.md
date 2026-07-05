# Mobile Vehicle Transfer Spec

**Area:** Mobile / Vehicle Transfer
**Status:** In progress
**Last updated:** 2026-07-05

---

## Overview

Vehicle Transfer on mobile covers initiating a transfer from the mobile app. The recipient's acceptance flow is browser-only in V1 — the transfer email link opens in the browser and the web app handles acceptance. Mobile does not handle `/transfers/[token]` URLs in V1. Deep linking is V2.

Core transfer behaviour (API, email, 7-day expiry, acceptance/decline) is unchanged from the web spec (`docs/specs/garage/vehicle-transfer.md`).

Design file: [`revlog-mobile-vehicle-transfer.html`](../../designs/mobile/revlog-mobile-vehicle-transfer.html)

---

## Use Cases

### UC-MOB-TRANSFER-1 — Owner initiates a Vehicle Transfer

**Actor:** Owner
**Precondition:** Owner is on Vehicle Detail for a Vehicle with no pending transfer.
**Milestones:** [V1](../../milestones/v1.md)

1. Owner taps `[⋮]` in the header, then `[Transfer vehicle]` in the menu — see `docs/specs/mobile-app/vehicle.md`'s Decisions for why Transfer lives in this menu rather than as its own header icon or action-row button.
2. App navigates to the Initiate Transfer screen.
3. Owner enters the recipient's email address and taps `[Send transfer]`.
4. App validates the email format (trim, lowercase, valid format — the same `initiateTransferSchema` the web app and API use). It does **not** check "not the Owner's own email" client-side — see this file's Decisions for why that check is server-only on mobile.
5. On valid: adds `INITIATE_TRANSFER` outbox entry. Vehicle is marked `transferPending: true` in local SQLite.
6. SyncService sends the outbox entry to `POST /vehicles/:vehicleId/transfer` when online.
7. App navigates back to Vehicle Detail. Vehicle is shown as locked (transfer pending).

---

### UC-MOB-TRANSFER-2 — Owner views a Vehicle with a pending transfer

**Actor:** Owner
**Precondition:** A transfer is pending for this Vehicle (locally marked or confirmed by sync).
**Milestones:** [V1](../../milestones/v1.md)

1. Vehicle Detail screen shows transfer-pending state: "Transfer pending — awaiting [recipient email]'s response."
2. Actions disabled: `[+ Log entry]`, `[Share report]`, `[Edit]`, and the `[⋮]` menu (which would otherwise offer `[Transfer vehicle]` / `[Delete vehicle]`).
3. `[Cancel transfer]` button is available in their place — this is the same screen/use case as `docs/specs/mobile-app/vehicle.md`'s UC-MOB-VEH-5, cross-referenced here for the transfer-specific detail.

---

### UC-MOB-TRANSFER-3 — Owner cancels a pending transfer

**Actor:** Owner
**Precondition:** A transfer is pending for this Vehicle.
**Milestones:** [V1](../../milestones/v1.md)

1. Owner taps `[Cancel transfer]` on Vehicle Detail.
2. App shows confirmation: "Cancel this transfer request?"
3. Owner confirms.
4. App clears `transferPending` in local SQLite and re-reads the Vehicle so the screen unlocks immediately (no navigation, no wait for sync); adds `CANCEL_TRANSFER` outbox entry.
5. SyncService sends the cancellation to the API in the background.

---

### UC-MOB-TRANSFER-4 — Transfer accepted or declined (sync update)

**Actor:** System (SyncService)
**Precondition:** Recipient has accepted or declined the transfer via the browser.
**Milestones:** [V1](../../milestones/v1.md)

1. SyncService pulls Vehicle data from the API.
2. If accepted: Vehicle is no longer present in the API response for this account. SyncService removes it from local SQLite. Owner's Garage no longer shows the Vehicle.
3. If declined: Vehicle is present in the API response without a pending transfer. SyncService updates local SQLite. Vehicle Detail shows as unlocked.

---

## Acceptance Criteria

- [ ] `[⋮]` menu on Vehicle Detail offers `[Transfer vehicle]` and `[Delete vehicle]` when unlocked; disabled together with Edit/Share/Log entry when a transfer is pending
- [ ] Initiate Transfer screen validates recipient email (required, valid format) via the shared `initiateTransferSchema`
- [ ] Submission writes `transferPending: true` to local SQLite and queues an `INITIATE_TRANSFER` outbox entry
- [ ] Vehicle Detail shows locked state when transfer is pending
- [ ] `[Cancel transfer]` shows a confirmation dialog, then clears pending state in SQLite (screen unlocks immediately, no navigation) and queues a `CANCEL_TRANSFER` outbox entry
- [ ] After accepted transfer, Vehicle is removed from local SQLite on next sync
- [ ] After declined transfer, Vehicle is unlocked on next sync
- [ ] `[Share report]` button is disabled during pending transfer (same rule as web)

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Acceptance is browser-only | Recipient opens email link in browser | Deep linking not in V1 scope; web already handles acceptance correctly |
| Optimistic lock on initiate | Mark `transferPending` in SQLite immediately | UX: Owner should see the locked state without waiting for outbox to flush |
| Cancel transfer ships on Vehicle Detail, not this file's Initiate Transfer screen | `[Cancel transfer]`, its confirmation dialog, and the `CANCEL_TRANSFER` call all live in `useVehicleDetailViewModel`/`VehicleDetailScreen` (`docs/specs/mobile-app/vehicle.md`) | UC-MOB-TRANSFER-3's own precondition was always "Owner is on Vehicle Detail" — cancelling only ever comes up while looking at the locked Vehicle, never from the Initiate Transfer screen (which isn't reachable once a transfer is already pending, since its own entry point in the `[⋮]` menu is disabled). This file specifies the use case; the implementation section of `vehicle.md` is where the code actually is |
| Transfer vehicle and Delete vehicle share Vehicle Detail's `[⋮]` overflow menu | See `docs/specs/mobile-app/vehicle.md`'s Decisions for the full reasoning (a design gap found while building this screen, resolved directly with the user) | Both are rare, once-per-Vehicle-lifetime actions; Edit and Share keep their direct header icons |
| Self-transfer check is server-side only on mobile | Initiate Transfer validates email format (`initiateTransferSchema`) but not "is this my own email" — the API's existing 400 catches it, surfaced as a generic submit error, with the local optimistic lock reverting on the next sync | Mobile's `Session` carries no email to compare against (`packages/api-client`'s `Session.user` is `{ id, accountId, role }`). Adding it is a real option but broader than this feature — see `docs/specs/mobile-app/vehicle.md`'s Decisions |
| `INITIATE_TRANSFER`/`CANCEL_TRANSFER` outbox payloads are `{ vehicleId, recipientEmail }` / `{ vehicleId }` | Mirrors the shape of every other outbox payload in `outboxHandlers.ts` (a plain object matching the API call's parameters) | No new convention needed — same pattern as `UPDATE_VEHICLE`'s `{ vehicleId, ...data }` |

---

## Out of scope

- In-app transfer acceptance screen → V2 (requires deep linking via Universal Links / App Links)
- Deep link handling for `/transfers/[token]` → V2
