# Session: Mobile Biometric Unlock & Offline Login

**Date:** 2026-07-05
**Branch:** worktree `mobile-biometric-offline-login` (draft PR; not merged this session — see Verification)

---

## Goal

Implement biometric authentication on mobile, which the auth spec (`docs/specs/mobile-app/auth.md` § V1 TODO) and the V1 milestone had promoted into scope but explicitly gated on "its own spec + ADR before implementation." During planning the scope widened, at the user's direction, into **credential-based offline login** as well — both rest on the same mechanism (store the Owner's credentials in the Keychain/Keystore on login), so they shipped together.

The starting state: the app clears **all** tokens on every cold start (UC-MOB-AUTH-7), so the Owner retyped email + password every launch and could not sign in at all while offline. Spec + ADR written this session: `docs/adr/0036-mobile-biometric-and-offline-login.md`, `docs/specs/mobile-app/biometric-offline-login.md`.

---

## Key Decisions

| Decision | Choice | Reason |
|---|---|---|
| What survives the cold-start clear | The Owner's **credentials** (email + password) + a session-identity blob, not tokens | Serves both offline login (validate a typed password) and biometric replay (fetch + re-login); a refresh token can't be validated offline and, under ADR 0017 rotation, can't be biometric-ACL-bound without re-prompting on every in-session refresh. Locked with the user. |
| Stored password form | Plaintext, in the OS-encrypted Keychain/Keystore | Biometric unlock and the silent re-auth both replay `POST /auth/login`, which needs the plaintext; one value keeps offline-compare, biometric replay, and silent re-auth consistent. Accepted tradeoff (user-approved): the reusable password sits at rest, protected by the same OS mechanism as the tokens. |
| Offline fallback trigger | **Network error only**, never a 4xx | A server `401` is a real rejection; only a no-response failure takes the offline path. Mirrors online-required logout (ADR 0034). |
| Offline session shape | Token-less `Session` (`accessToken: ''`) + an `isOffline` flag in `AuthProvider` context | Keeps the shared `Session` type (`packages/api-client`) unchanged so web is untouched; `SyncProvider` gates network I/O on it. |
| Reconnect behaviour | Silent re-login on app foreground | Mints real tokens so the outbox can flush; a `401` clears stale credentials and bounces to login. |
| Enrolment | One-time prompt after the first online login **+** a Settings toggle | Reaches every user incl. existing accounts on a new device; the Onboarding screen is still an unbuilt placeholder, so a dedicated `enable-biometrics` screen hosts the prompt instead. Locked with the user. |
| Biometric unlock location | On the login screen (auto-prompts on mount) | Fewer surfaces; password + biometric in one place; an offline biometric unlock reuses the same `useSignIn` path. |
| E2E seam | Stub **only** `biometrics.authenticate()` behind `EXPO_PUBLIC_E2E`; keep `isAvailable()` real | Forcing availability would divert *every* UI login into the enrolment prompt and break the existing suite; the biometric spec enrols a biometric on the simulator instead, so only it sees biometrics as available. |

---

## What Was Built

Delivered doc-first, one logical step per commit.

### Documentation (`docs(mobile): ADR 0036 + spec …` — 3cf99c1)
- **`docs/adr/0036-mobile-biometric-and-offline-login.md`** (new) — the decision, the three rejected alternatives for what survives the clear, the token-less offline session, silent upgrade, and the E2E seam.
- **`docs/specs/mobile-app/biometric-offline-login.md`** (new) — UC-MOB-BIO-1/2 (enrol, unlock), UC-MOB-OFF-1/2 (offline login, silent upgrade), acceptance criteria, decisions.
- Amended `docs/specs/mobile-app/auth.md` (UC-MOB-AUTH-7 now notes credentials, not tokens, persist), appended a dated update to `docs/adr/0025`, and flipped the `docs/milestones/v1.md` item.

### Dependency + native config (`build(mobile): add expo-local-authentication …` — 6ca08da)
- `expo-local-authentication` (~57.0.0) + its config plugin in `app.config.ts` (`faceIDPermission` → `NSFaceIDUsageDescription`; Android biometric permissions). Requires prebuild.

### Infrastructure
- **`infrastructure/storage/credentialStore.ts`** (new, 5eb31d9) — Keychain-backed `{ email, password }` + identity; its own key, **not** cleared by `secureStorage.clear()` (survives the cold-start token clear, like the DB key), removed only on logout.
- **`infrastructure/storage/preferences.ts`** (5eb31d9) — `biometricUnlockEnabled` / `hasPromptedBiometric` flags + `clearBiometric()`.
- **`infrastructure/biometrics/biometrics.ts`** (new, e0c9c41 / narrowed in 8badd76) — `isAvailable()` (real) + `authenticate()` (stubbed to success under `EXPO_PUBLIC_E2E`).

### Application
- **`application/auth/useSignIn.ts`** + **`offlineSession.ts`** (new, 2fdf491 / eff8e19) — the one sign-in path shared by the login screen and biometric unlock: online-first, network-error fallback to stored credentials, credential capture on success.
- **`providers/AuthProvider.tsx`** (eff8e19) — `isOffline`, `hasStoredCredentials` (cold-start probe for RootRedirect), credential-clearing `clearSession`, and the foreground offline→online silent upgrade.
- **`providers/SyncProvider.tsx`** (61235bc) — skips sync while `isOffline`; re-fires on the upgrade.
- **`navigation/RootRedirect.tsx`** (1535b61) — no-session + stored credentials → `/(auth)/login` (offline + biometric sign-in) instead of Welcome.
- **`screens/login/`** (ee02665) — `useSignIn`-driven; reveals an "Unlock with biometrics" button and auto-prompts on mount when set up; routes to enrolment after a first online login.
- **`screens/enable-biometrics/`** + `app/(auth)/enable-biometrics.tsx` (new, 4c502e1) — the one-time enrolment prompt (Enable / Not now).
- **`screens/settings/`** (13aaaca) — an "Unlock with biometrics" `Switch`, shown only when hardware + credentials are present.

### Tests (`test(mobile): Appium biometric-unlock E2E …` — 8badd76, plus co-located unit tests in every commit above)
- Unit tests for `credentialStore`, `preferences`, `biometrics`, `useSignIn`, `AuthProvider` (incl. the foreground upgrade via a captured `AppState` handler), `SyncProvider` gate, `RootRedirect`, and the login / enable-biometrics / settings viewmodels.
- `e2e/specs/biometric.e2e.ts` (new) + `e2e/support/biometric.ts` (enrol/unenrol), registered **last** in `wdio.shared.conf.ts`.

---

## Verification

- `pnpm --filter @maintenance-log/mobile test`: **307/307 pass** (29 suites).
- `pnpm --filter @maintenance-log/mobile type-check` (`tsc --noEmit`): 0 errors.
- `tsc --noEmit -p apps/mobile/e2e/tsconfig.json`: 0 errors.
- Pre-commit hook (raw-hex scan) passed on every commit; no inline `style={{}}` introduced. (`eslint` is not wired up for the mobile package — never has been; typecheck + the hex hook are the guardrails.)
- **Appium E2E was not run** — no simulator/dev-client was available in this environment. `biometric.e2e.ts` is written, typechecks, and is registered, but is unverified live, as this repo's other recent mobile E2E work has shipped.
- **Not merged.** Per background-agent rules this session opened a **draft PR** rather than merging into `main` (the CLAUDE.md "merge the worktree branch" step is left for the user to do after review).

### Follow-ups that need a simulator to validate (flagged, not done)
1. **Existing E2E specs' cold-start assumption.** Credentials now persist across cold start, so after any UI login `RootRedirect` lands on the **login screen**, not Welcome. The existing per-spec `goToLogin` helpers assume Welcome and will need to tolerate the login-screen landing (as `biometric.e2e.ts`'s `goToLoginForm` does). This wasn't applied to the 10 existing specs blind, since it can't be validated here.
2. **`EXPO_PUBLIC_E2E=1` must be set at E2E build time** for the biometric spec's `authenticate` stub. With the authenticate-only seam this is safe for the rest of the suite (availability stays real).
3. A live run of the full offline-login + biometric flow on a device.

---

## Out of Scope

- **Real OS-modal biometric automation** in E2E → the test-seam stubs `authenticate` (ADR 0036 V2+).
- **Onboarding-screen enrolment** → the one-time post-login prompt is used instead; the Onboarding screen remains a placeholder.
- **Configurable offline-session lifetime / forced periodic re-auth** → V2.
- **Multi-account biometric** (several accounts on one device) → single-account model in V1.
