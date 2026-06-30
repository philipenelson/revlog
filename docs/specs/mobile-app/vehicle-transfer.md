# Mobile Vehicle Transfer Spec

**Area:** Mobile / Vehicle Transfer
**Status:** Not started
**Last updated:** 2026-06-30

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

1. Owner taps `[Transfer vehicle]`.
2. App navigates to the Initiate Transfer screen.
3. Owner enters the recipient's email address and taps `[Send transfer]`.
4. App validates the email (same rules as web: trim, lowercase, valid format, not the Owner's own email).
5. On valid: adds `INITIATE_TRANSFER` outbox entry. Vehicle is marked `transferPending: true` in local SQLite.
6. SyncService sends the outbox entry to `POST /vehicles/:vehicleId/transfers` when online.
7. App navigates back to Vehicle Detail. Vehicle is shown as locked (transfer pending).

---

### UC-MOB-TRANSFER-2 — Owner views a Vehicle with a pending transfer

**Actor:** Owner
**Precondition:** A transfer is pending for this Vehicle (locally marked or confirmed by sync).
**Milestones:** [V1](../../milestones/v1.md)

1. Vehicle Detail screen shows transfer-pending state: "Transfer pending — awaiting [recipient email]'s response."
2. Actions disabled: `[+ Log entry]`, `[Edit]`, `[Share report]`, `[Delete]`, `[Transfer vehicle]`.
3. `[Cancel transfer]` button is available.

---

### UC-MOB-TRANSFER-3 — Owner cancels a pending transfer

**Actor:** Owner
**Precondition:** A transfer is pending for this Vehicle.
**Milestones:** [V1](../../milestones/v1.md)

1. Owner taps `[Cancel transfer]` on Vehicle Detail.
2. App shows confirmation: "Cancel this transfer request?"
3. Owner confirms.
4. App clears `transferPending` in local SQLite; adds `CANCEL_TRANSFER` outbox entry.
5. Vehicle immediately unlocks in the UI. SyncService sends the cancellation to the API.

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

- [ ] Initiate Transfer screen validates recipient email (required, valid, not own email)
- [ ] Submission writes `transferPending: true` to local SQLite and queues outbox entry
- [ ] Vehicle Detail shows locked state when transfer is pending
- [ ] Cancel clears pending state in SQLite and queues outbox entry
- [ ] After accepted transfer, Vehicle is removed from local SQLite on next sync
- [ ] After declined transfer, Vehicle is unlocked on next sync
- [ ] `[Share report]` button is disabled during pending transfer (same rule as web)

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Acceptance is browser-only | Recipient opens email link in browser | Deep linking not in V1 scope; web already handles acceptance correctly |
| Optimistic lock on initiate | Mark `transferPending` in SQLite immediately | UX: Owner should see the locked state without waiting for outbox to flush |

---

## Out of scope

- In-app transfer acceptance screen → V2 (requires deep linking via Universal Links / App Links)
- Deep link handling for `/transfers/[token]` → V2
