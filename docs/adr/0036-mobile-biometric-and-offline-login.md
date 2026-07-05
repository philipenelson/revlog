# Mobile biometric unlock & credential-based offline login

## Context

The mobile app clears **all** auth tokens on every cold start (ADR 0025's 2026-07-02 update, `docs/specs/mobile-app/auth.md` UC-MOB-AUTH-7). Two consequences follow:

1. The Owner must retype email + password on every launch — there is no fast path back in.
2. The app cannot be signed into at all while offline: a session only exists after a successful `POST /auth/login`, and there is nothing to fall back to when the server is unreachable.

Biometric unlock was promoted into V1 (`docs/specs/mobile-app/auth.md` § V1 TODO, `docs/milestones/v1.md`) as the fast path back in, explicitly gated on "its own spec + ADR before implementation." This ADR records the decision; the feature spec is `docs/specs/mobile-app/biometric-offline-login.md`.

The core question is *what survives the cold-start clear so the Owner can get back in*. Three mechanisms were considered:

- **Retain the refresh token, gated by the OS Keychain biometric ACL (`expo-secure-store` `requireAuthentication`).** The OS binds the secret to biometric presence — the strongest at-rest guarantee. But ADR 0017 rotates the refresh token on **every** refresh, and a biometric-ACL item requires authentication to *overwrite*, so each in-session rotation would re-trigger a Face ID prompt. Incompatible with rotation without unacceptable UX.
- **Retain the refresh token, gated by an app-level biometric prompt (token in normal secure store).** Rotation-friendly, but the persisted secret is a live session token — and it still only solves the *biometric* fast path, not offline login (a refresh token cannot be validated offline against a typed password).
- **Store the Owner's credentials.** Persist the email + password (and enough session identity to rebuild a `Session`) in the Keychain/Keystore. This is the only option that serves **both** goals: offline login can validate a typed password against the stored one, and biometric unlock can fetch the stored credentials and replay a normal login. This is the option chosen.

## Decision

On a successful **online** login, persist the Owner's credentials and a small session-identity blob in the OS Keychain/Keystore (via a new `infrastructure/storage/credentialStore.ts`, kept separate from `secureStorage.ts`). This unlocks three flows.

### 1. Credentials at rest

`credentialStore` holds `{ email, password }` plus `{ userId, accountId, role, accountStatus }` (the fields of `Session` that are not the tokens). It uses its own Keychain keys, which — like the DB encryption key (`getOrCreateDbKey`) — are **not** touched by `secureStorage.clear()`, so they survive the cold-start token clear. They are cleared explicitly only on logout.

The password itself is stored (not a hash). A hash would suffice for offline *comparison*, but biometric unlock and silent re-auth both need to **replay** `POST /auth/login`, which requires the plaintext. Storing one value keeps offline-compare, biometric replay, and silent re-auth consistent. Accepted tradeoff: the reusable password sits at rest, protected by OS hardware encryption + the app sandbox (the same protection the tokens already rely on). A native app does not have the browser's XSS exposure that makes an httpOnly cookie the right choice on web (see ADR 0025), so Keychain/Keystore storage of a credential is the standard, acceptable model.

### 2. Offline login (network-error fallback)

`login` becomes online-first with an offline fallback, orchestrated by a shared `application/auth/useSignIn.ts` used by both the login screen and biometric unlock:

```
try POST /auth/login → online session; store creds + identity; done
catch ApiError (< 500)  → invalid credentials (NO offline fallback — the server said no)
catch ApiError (>= 500) → service error
catch network / timeout → offline fallback:
    read credentialStore; if typed email+password match the stored pair AND identity exists
       → reconstruct a token-less Session; sign in offline
    else → "offline, credentials don't match your last sign-in on this device"
```

The network-vs-`ApiError` distinction mirrors online-required logout (ADR 0034): only a genuine no-response failure takes the offline path; a `401`/`403` means the server rejected the credentials and the offline path must not paper over it.

### 3. The token-less "offline session"

Offline there are no fresh tokens, so the reconstructed `Session` carries `accessToken: ''` (sentinel) and an epoch `accessTokenExpiresAt`, with `user`/`account` rebuilt from the stored identity. The shared `Session` type (`packages/api-client`) is **unchanged** — web never produces this. `AuthProvider` tracks an `isOffline` flag in context (derived from the empty access token), and:

- **Reads** work — they come from local SQLite (offline-first, ADR 0026), never the network.
- **Writes** queue to the outbox as normal (ADR 0027).
- **Sync is deferred.** `SyncProvider` skips network I/O while `isOffline` — a token-less session would only produce doomed `401`s.

### 4. Silent online-upgrade

When an `isOffline` session is live and the app returns to the foreground, `AuthProvider` silently replays `signIn(storedCredentials)`:

- **Network error** → stay offline (try again next foreground).
- **Success** → replace with a real token-bearing session; `SyncProvider` then flushes the outbox and pulls.
- **`401`** → the stored password is stale (changed server-side); `clearSession()` and route to login for a fresh sign-in.

### 5. Biometric unlock

`expo-local-authentication` is the library (the standard Expo choice; queries `hasHardwareAsync`/`isEnrolledAsync` and presents the OS prompt). It is wrapped by `infrastructure/biometrics/biometrics.ts` exposing `isAvailable()` and `authenticate(reason)`.

- **Enrolment** is opt-in: a one-time "Enable biometric unlock?" prompt after the first successful login on a device, plus a toggle in Settings → Preferences. A `biometricUnlockEnabled` flag lives in `preferences.ts` (non-secret, alongside `appLocale`).
- **Unlock** lives on the login screen: when biometric is enabled and credentials are stored, cold-start routing lands on `/(auth)/login`, which auto-prompts biometry, fetches the stored credentials, and runs them through `useSignIn` (so an offline biometric unlock still works, landing in the offline session). "Use password instead" always falls back to the form.

### Relationship to UC-MOB-AUTH-7 (preserved)

Tokens are still cleared on every cold start; the app still never *silently* restores a session. What now persists is the **credentials**, not the session. Every launch still requires an explicit sign-in *action* — typing a password or a biometric tap. This is an amendment to what persists, not a reversal of the "sign in every launch" contract. See ADR 0025's appended update.

### Testing: E2E test-seam

The biometric prompt is an OS-native modal Appium cannot reliably drive. Behind `EXPO_PUBLIC_E2E === '1'`, `biometrics.isAvailable()` returns `true` and `biometrics.authenticate()` resolves success, so the Appium flow (enable → restart → auto-unlock → Garage) runs deterministically on both platforms. The "Use password instead" fallback is a plain button and needs no seam. All unlock/offline logic is additionally unit-tested in `useSignIn` and the viewmodels (humble-object pattern).

## Status

accepted

## Consequences

- The reusable password is stored in the Keychain/Keystore. This is the deliberate cost of offline + biometric login; it is protected by the same OS mechanism as the tokens, and cleared on logout.
- Offline login validates against the last-stored password. If the Owner changes their password on the web after their last device login, the *old* password still works offline until the next online login; the silent-upgrade `401` path clears stale credentials once connectivity returns.
- A new auth state exists (`isOffline`): full local reads + queued writes, no sync, auto-upgrading on reconnect. `SyncProvider` and any future network caller must respect it.
- `expo-local-authentication` is added; its config plugin sets `NSFaceIDUsageDescription` (iOS) and requires prebuild/dev-client (already the norm here for SQLCipher).
- No API change. This is entirely client-side; the server sees ordinary `POST /auth/login` calls.

## V2+ items

- Real OS-modal biometric automation in E2E (currently the test-seam) → V2.
- Biometric enrolment inside a built-out Onboarding screen (currently a one-time post-login prompt) → whenever Onboarding is built.
- Configurable offline-session lifetime / periodic re-auth requirement → V2 if a policy need arises.
