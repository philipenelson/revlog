# Mobile Onboarding Wizard Spec

**Area:** Mobile / Onboarding
**Route:** `/onboarding`
**Status:** Spec'd, ready to build
**Last updated:** 2026-07-06

---

## Overview

A 3-step wizard shown immediately after a brand-new Owner's account is verified, whenever the post-auth routing rule finds the Account in `ONBOARDING` (see [`navigation.md`](./navigation.md) — Auth gate, and `routeForAccountStatus`). It walks the Owner through registering their first Vehicle so the Garage is never empty by accident — populated through the wizard or explicitly skipped.

This is the mobile counterpart of the web [`onboarding-wizard.md`](../onboarding/onboarding-wizard.md) and follows the same 3-step shape (**Welcome → Your vehicle → Ready**) and the design in [`revlog-mobile-onboarding.html`](../../designs/mobile/revlog-mobile-onboarding.html). It diverges from the web in exactly one architecturally-significant way, driven by the mobile app's rules (see Decisions):

- **Onboarding is online-only.** It is reached only right after an online OTP verification ([ADR 0037](../../adr/0037-email-verification-otp.md)) or an online login, so connectivity is a safe precondition. Skip requires the network.
- **The first Vehicle is created through the repository, not a direct API call.** Per the mobile offline-first rules, syncable data (vehicles) is written to SQLite + outbox by `VehicleRepository`, never `POST`ed directly. The Vehicle lands in local SQLite immediately (so the Garage can read it offline afterward) and the outbox flushes `POST /vehicles` while online.

---

## Layout

Centred single-column screen on `surface-base`, mirroring the mobile Welcome / Enable-Biometrics screens:

| Element | Content |
|---|---|
| Step indicator | Three "gauge-tick" segments filling left-to-right; the active segment carries the accent glow — the tachometer motif from the logo |
| Step content | Swaps per step: Welcome copy + CTA → Vehicle form → Confirmation with a spec plate |

---

## Use Cases

### UC-MOB-ONB-1 — Complete onboarding by adding a first vehicle

**Actor:** New Owner whose Account is in `ONBOARDING` with an empty Garage
**Precondition:** Authenticated and online
**Milestones:** [V1](../../milestones/v1.md)

1. Owner lands on `/onboarding`, **Step 1 — Welcome** shows an explanation and an "Add my first vehicle" primary action plus a "Skip for now" link.
2. Owner taps "Add my first vehicle" → **Step 2 — Your vehicle**.
3. Owner fills Make, Model, Year, Current mileage (Nickname optional).
4. Owner taps "Continue".
5. Input is validated client-side with `createVehicleSchema` (the same schema the Add Vehicle screen and the API use).
6. **Valid:** the Vehicle is created via `VehicleRepository.create` (SQLite + outbox), the in-memory session's `account.status` is flipped to `ACTIVE` (`resolveOnboarding`), and the wizard advances to **Step 3 — Ready** with a spec plate of the entered data.
7. Owner taps "Go to my garage" → `/garage`, where the new Vehicle appears (read from SQLite).

**Errors:**

| Condition | Result |
|---|---|
| Required field empty or Year/Mileage non-numeric | Inline message under the field; "Continue" does not advance |
| Repository write fails | Inline "Couldn't save your vehicle. Try again in a moment."; stays on Step 2 |

### UC-MOB-ONB-2 — Skip onboarding

**Actor:** New Owner who does not want to add a Vehicle yet
**Precondition:** Same as UC-MOB-ONB-1
**Milestones:** [V1](../../milestones/v1.md)

1. From **Step 1**, Owner taps "Skip for now".
2. The app calls `skipOnboarding(tokenHttpClient)` (online-only op, direct api-client call — like login/register), flips the in-memory `account.status` to `ACTIVE`, and navigates to `/garage` (empty state).
3. On failure: inline "Couldn't skip right now. Try again in a moment."; retrying recovers.
4. The wizard is not shown again on a later sign-in — the server transitioned the Account to `ACTIVE` (ADR 0015), and a subsequent login routes to `/garage`.

### UC-MOB-ONB-3 — Returning to onboarding mid-flow

**Actor:** Owner who leaves before finishing
**Precondition:** Account still `ONBOARDING`
**Milestones:** [V1](../../milestones/v1.md)

1. Owner revisits `/onboarding` (or the post-login redirect fires again).
2. The wizard restarts at Step 1 — no partial-progress persistence in V1.

---

## Account-status resolution (the key decision)

Both completing and skipping resolve onboarding by flipping the Account out of `ONBOARDING`:

- **Skip** → `skipOnboarding` transitions the Account server-side and returns; the client flips the in-memory session to `ACTIVE`.
- **Complete** → the Account transitions **server-side when the outbox flushes `POST /vehicles`** (ADR 0015); the client flips the in-memory session to `ACTIVE` **optimistically** so the Owner is not bounced back into onboarding before the flush lands.

`AuthProvider.resolveOnboarding()` performs the flip: it updates the in-memory `session.account.status` and, if a stored credential exists (offline/biometric login carve-out, ADR 0036), re-saves it with `accountStatus: 'ACTIVE'` so a later cold-start or offline login does not route a resolved Account back into onboarding.

---

## Acceptance Criteria

- [ ] Step 1 shows the step indicator at segment 1, an "Add my first vehicle" primary action, and a "Skip for now" link
- [ ] "Add my first vehicle" advances to Step 2; "Back" returns to Step 1 without losing entered data
- [ ] Step 2 renders Make, Model, Year (numeric), Current mileage (numeric), Nickname (optional)
- [ ] "Continue" with empty/invalid required fields shows inline errors and does not advance
- [ ] "Continue" with valid input creates the Vehicle via `VehicleRepository`, flips the account to `ACTIVE`, and advances to Step 3
- [ ] A repository failure shows an inline error and stays on Step 2; retrying recovers
- [ ] Step 3 shows a spec plate (Nickname or Make + Model, Year, Mileage) and a "Go to my garage" action that routes to `/garage`
- [ ] "Skip for now" calls `skipOnboarding`, flips the account to `ACTIVE`, and routes to `/garage`; a failure shows an inline error and retrying recovers
- [ ] No "service due" / scheduled-maintenance language anywhere (V2-only)
- [ ] Domain language matches CONTEXT.md ("Vehicle", "Garage", "Owner")

### Tests

- [ ] ViewModel unit tests cover the step machine, validation gate, repository-create + resolve + advance, skip + resolve + route, and both error paths
- [ ] Appium E2E covers the happy path (welcome → vehicle → ready → garage) and the skip path

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Onboarding connectivity | Online-only | Reached only right after online OTP verification / login; skip needs the network. Removes any offline-onboarding edge from V1 |
| First-vehicle creation | `VehicleRepository.create` (SQLite + outbox), **not** a direct `POST /vehicles` | Mobile offline-first rules: syncable data always goes through the repository so the Garage can read it offline afterward. Diverges intentionally from the web wizard, which POSTs directly |
| Account-status flip | Optimistic in-memory flip via `AuthProvider.resolveOnboarding`, plus cached-credential update | Mirrors the web wizard's optimistic `activateAccount`. The server confirms independently (skip endpoint, or the outbox `POST /vehicles`); the local flip prevents an immediate re-route into onboarding |
| Skip | `skipOnboarding(tokenHttpClient)` directly | Online-only op never persisted locally — same rule login/register/report-token follow (mobile CLAUDE.md; ADR 0036) |
| Validation | `createVehicleSchema.safeParse` | The same schema the Add Vehicle screen and API use; no duplicated field rules |
| Partial-progress persistence | None in V1 | Short flow; matches the web wizard's V1 decision |

---

## Out of scope

- Vehicle photo upload during onboarding — the Add Vehicle screen owns photos; onboarding collects only the spec-plate fields (deferred to keep the first-run flow minimal)
- Make/Model/Year reference dataset (free-text for now — tracked on the web [onboarding-wizard.md](../onboarding/onboarding-wizard.md))
- The Garage empty state (separate — [`garage.md`](./garage.md))
