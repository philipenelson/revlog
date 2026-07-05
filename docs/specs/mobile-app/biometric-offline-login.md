# Mobile Biometric Unlock & Offline Login Spec

**Area:** Mobile / Auth
**Status:** In progress
**Last updated:** 2026-07-05

---

## Overview

This feature gives the mobile Owner two things the base auth flow (`docs/specs/mobile-app/auth.md`) cannot: a fast biometric path back in after the cold-start token clear, and the ability to sign in **while offline**. Both are built on one mechanism — storing the Owner's credentials in the Keychain/Keystore on a successful online login — and both funnel through one shared sign-in path.

See [ADR 0036](../../adr/0036-mobile-biometric-and-offline-login.md) for the decision and rejected alternatives (retained refresh token / OS-ACL binding), and [ADR 0025](../../adr/0025-mobile-auth-token-storage.md) for the token-storage baseline this amends.

**Key points:**

- On a successful online `POST /auth/login`, the app stores `{ email, password }` and a session-identity blob `{ userId, accountId, role, accountStatus }` in the Keychain/Keystore (`credentialStore`). These keys survive the cold-start token clear and are removed only on logout.
- Login is online-first with an offline fallback: a genuine **network** failure (not a `401`/`403`) validates the typed credentials against the stored pair and grants a **token-less offline session**.
- Biometric unlock fetches the stored credentials after a biometry check and runs them through the same sign-in path.
- An offline session **upgrades silently** to a real one when connectivity returns.
- UC-MOB-AUTH-7 still holds: tokens are cleared every launch, no session is silently restored — only credentials persist, so every launch still needs an explicit sign-in action.

---

## Use Cases

### UC-MOB-BIO-1 — Owner enables biometric unlock

**Actor:** Owner
**Precondition:** Owner has signed in online at least once on this device (credentials are stored); the device has enrolled biometric hardware.
**Milestones:** [V1](../../milestones/v1.md)

Two entry points:

1. **One-time post-login prompt.** After the first successful online login on a device, if biometric hardware is available and the Owner has not been prompted before, the app shows an "Enable biometric unlock?" screen.
   - `[Enable]` → runs a biometry check; on success sets `biometricUnlockEnabled = true`; marks the Owner as prompted; continues to the account's home route.
   - `[Not now]` → marks the Owner as prompted; continues. The prompt does not appear again (the Settings toggle remains).
2. **Settings toggle.** Settings → Preferences shows an "Unlock with Face ID / biometrics" switch (only when the hardware is available).
   - Toggling **on** runs a biometry check; on success sets `biometricUnlockEnabled = true`. On biometry failure/cancel the switch stays off.
   - Toggling **off** sets `biometricUnlockEnabled = false`. Stored credentials remain (offline typed-login still uses them).

---

### UC-MOB-BIO-2 — Owner unlocks with biometrics

**Actor:** Owner
**Precondition:** `biometricUnlockEnabled = true` and credentials are stored; app is cold-starting (tokens already cleared per UC-MOB-AUTH-7).
**Milestones:** [V1](../../milestones/v1.md)

1. Cold-start routing sends the Owner to the login screen (not Welcome) because credentials are stored.
2. The login screen auto-presents the biometry prompt (and offers an "Unlock with Face ID" button + a "Use password instead" link).
3. On biometry **success**: the app fetches the stored credentials and runs them through the sign-in path (UC-MOB-OFF-1) — online if reachable, offline otherwise — landing in the Garage.
4. On biometry **cancel/failure**: the app shows the normal email/password form ("Use password instead"). No lockout — the Owner can retry biometrics or type their password.

---

### UC-MOB-OFF-1 — Owner logs in while offline

**Actor:** Owner
**Precondition:** Owner has signed in online at least once on this device (credentials are stored); the app is on the login screen; the server is unreachable.
**Milestones:** [V1](../../milestones/v1.md)

1. Owner enters email + password (or arrives here via biometric unlock with fetched credentials) and submits.
2. The app calls `POST /auth/login`. The request fails with a **network** error (no response).
3. The app reads the stored credentials. If the submitted email + password match the stored pair **and** a stored identity exists:
   - It reconstructs a **token-less session** (`accessToken: ''`, identity from the stored blob) and signs the Owner in offline.
   - The Garage renders from local SQLite (offline-first). Writes queue to the outbox; sync is deferred.
4. If they do not match (or nothing is stored): the login screen shows "You're offline and these credentials don't match your last sign-in on this device."
5. If instead the server **responds** with invalid credentials (`401`), the normal "incorrect email or password" error shows — the offline path is not taken.

---

### UC-MOB-OFF-2 — Offline session upgrades to online

**Actor:** System
**Precondition:** Owner is in a token-less offline session; the app returns to the foreground.
**Milestones:** [V1](../../milestones/v1.md)

1. `AuthProvider` detects the foreground transition while `isOffline`.
2. It silently replays `POST /auth/login` with the stored credentials.
3. **Network error** → remains offline; retries on the next foreground.
4. **Success** → replaces the session with a real token-bearing one; `SyncProvider` flushes the outbox and pulls fresh data. The Owner sees no interruption.
5. **`401`** (password changed server-side) → the stored credentials are stale; the app clears the session + credentials and routes to the login screen for a fresh sign-in.

---

## Acceptance Criteria

- [ ] A successful online login stores `{ email, password }` + identity in the Keychain/Keystore; these survive a cold start and are cleared on logout.
- [ ] Login is online-first; a **network** failure falls back to validating against stored credentials, a `401` does not.
- [ ] Offline login with matching credentials grants a token-less session that renders the Garage from cache and queues writes; sync does not run while offline.
- [ ] Offline login with non-matching credentials (or no stored credentials) shows the offline-mismatch error.
- [ ] A one-time "Enable biometric unlock?" prompt appears after the first login when hardware is available; declining does not show it again.
- [ ] Settings shows a biometric toggle only when hardware is available; on enables (after a biometry check), off disables.
- [ ] With biometric enabled, a cold start routes to login and auto-presents biometry; success signs in, "Use password instead" falls back to the form.
- [ ] A foreground while offline silently upgrades to a real session on success; a `401` clears stale credentials and routes to login.
- [ ] The biometric *prompt* is stubbed behind `EXPO_PUBLIC_E2E` (availability stays real) so the Appium unlock flow is deterministic without diverting the rest of the suite.

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| What survives cold start | Credentials (email + password) + session identity, not tokens | Serves both offline login (validate typed password) and biometric replay; tokens can't be validated offline. See ADR 0036. |
| Stored password form | Plaintext (in Keychain/Keystore) | Biometric replay + silent re-auth need to replay `POST /auth/login`, which needs the plaintext; one value keeps all three flows consistent. |
| Offline fallback trigger | Network error only (not `401`) | A server `401` is a real rejection; mirrors online-required logout (ADR 0034). |
| Offline session shape | Token-less `Session` (`accessToken: ''`), `isOffline` flag in context | Keeps the shared `Session` type unchanged; sync gates on it. |
| Reconnect behaviour | Silent re-login on foreground | Mints real tokens so the outbox can flush; `401` clears stale creds. |
| Biometric library | `expo-local-authentication` | Standard Expo choice; hardware/enrolment queries + OS prompt. |
| Enrolment | One-time post-login prompt + Settings toggle | Reaches every user incl. existing accounts on a new device; Onboarding screen is an unbuilt placeholder. |
| Biometric unlock location | On the login screen (auto-prompt) | Fewer surfaces; password + biometric in one place; offline biometric unlock reuses the login path. |
| E2E | Stub `authenticate()` behind `EXPO_PUBLIC_E2E`; keep `isAvailable()` real | OS biometric modal isn't drivable in Appium, but forcing availability would divert every UI login into the enrolment prompt; the biometric spec enrols on the simulator instead. |

---

## Out of scope

- Real OS-modal biometric automation in E2E → V2 (test-seam for now).
- Biometric enrolment inside a built-out Onboarding screen → whenever Onboarding is built.
- Configurable offline-session lifetime / forced periodic re-auth → V2.
- Per-account biometric (multiple accounts on one device) → single-account model in V1.
