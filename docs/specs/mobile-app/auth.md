# Mobile Auth Spec

**Area:** Mobile / Auth
**Status:** Not started
**Last updated:** 2026-06-30

---

## Overview

Mobile auth covers login, register, email verification, forgot password, silent token refresh, and logout. The core use cases mirror the web app specs (`docs/specs/auth/`) — this spec documents mobile-specific differences only.

Key differences from web:

- Tokens are stored in `expo-secure-store` (iOS Keychain / Android Keystore) rather than httpOnly cookies. See ADR 0025.
- The `TokenHttpClient` injects `Authorization: Bearer <accessToken>` on every authenticated request and `Refresh-Token: <refreshToken>` on `POST /auth/refresh` calls.
- Silent token refresh is triggered both pre-request (same as web) and on app foreground (`AppState` change from `background` to `active`).
- Forgot password: the Owner enters their email on mobile and receives a reset link by email. The reset form is completed in the browser — the mobile app does not handle the reset URL in V1.

Design files: [`revlog-mobile-auth.html`](../../designs/mobile/revlog-mobile-auth.html) (login, register) · [`revlog-mobile-verify-email.html`](../../designs/mobile/revlog-mobile-verify-email.html) · [`revlog-mobile-forgot-password.html`](../../designs/mobile/revlog-mobile-forgot-password.html)

---

## Use Cases

### UC-MOB-AUTH-1 — Owner logs in

**Actor:** Owner
**Precondition:** Owner has a verified Revlog account; app is on the login screen.
**Milestones:** [V1](../../milestones/v1.md)

1. Owner enters email and password and taps `[Sign in]`.
2. App calls `POST /auth/login` via `TokenHttpClient`.
3. On success: app stores `accessToken` and `refreshToken` in `expo-secure-store` and memory; navigates to Garage.
4. On invalid credentials: login screen shows "Incorrect email or password."
5. On unverified account: login screen shows "Please verify your email before signing in."

---

### UC-MOB-AUTH-2 — Owner registers

**Actor:** New user
**Precondition:** App is on the login screen.
**Milestones:** [V1](../../milestones/v1.md)

Same flow as web (UC-AUTH-2). On success, app navigates to a "Check your email" confirmation screen. The verification link in the email opens in the browser; the Owner then returns to the app and logs in.

---

### UC-MOB-AUTH-3 — Owner verifies their email

**Actor:** Owner
**Precondition:** Owner received the verification email; taps the link in their email client.
**Milestones:** [V1](../../milestones/v1.md)

The verification link opens in the browser (same as web — `GET /verify-email?token=...`). The web app handles the verification and signs the Owner in on web. The Owner then opens the mobile app and logs in. Deep linking for automatic mobile sign-in after email verification is V2.

---

### UC-MOB-AUTH-4 — Owner resets forgotten password

**Actor:** Owner
**Precondition:** App is on the login screen; Owner taps `[Forgot password?]`.
**Milestones:** [V1](../../milestones/v1.md)

1. App navigates to the forgot-password screen.
2. Owner enters their email address and taps `[Send reset link]`.
3. App calls `POST /auth/forgot-password`.
4. On success (or if email not found — to avoid enumeration): screen shows "If an account exists for that email, a reset link has been sent. Check your inbox."
5. Owner taps the reset link in the email; it opens in the browser. The browser-based reset flow (web app) completes the password change.
6. Owner returns to the mobile app login screen and logs in with the new password.

---

### UC-MOB-AUTH-5 — Silent token refresh on foreground

**Actor:** System
**Precondition:** Owner has a valid session; app transitions from background to active (`AppState` change).
**Milestones:** [V1](../../milestones/v1.md)

1. `AuthProvider` detects `AppState` change to `active`.
2. `AuthProvider` checks whether the access token is within 60 seconds of expiry.
3. If near expiry: calls `POST /auth/refresh` with `Refresh-Token` header.
4. On success: new access token and refresh token written to secure store and memory. Owner sees no interruption.
5. If refresh fails (refresh token expired or revoked): clears secure store, navigates to login screen.

---

### UC-MOB-AUTH-6 — Owner logs out

**Actor:** Owner
**Precondition:** Owner is authenticated; is on the Settings screen.
**Milestones:** [V1](../../milestones/v1.md)

1. Owner taps `[Log out]`.
2. App shows a confirmation: "Log out of Revlog?"
3. Owner confirms.
4. App clears `accessToken` and `refreshToken` from `expo-secure-store` and memory.
5. App calls `POST /auth/logout` to invalidate the refresh token server-side.
6. App navigates to the login screen. Local SQLite data remains on device (re-populated on next login).

---

## Acceptance Criteria

- [ ] Login stores tokens in expo-secure-store and navigates to Garage on success
- [ ] Login shows error for incorrect credentials
- [ ] Login shows error for unverified account
- [ ] Register navigates to "Check your email" screen on success
- [ ] Forgot password screen sends reset email and shows confirmation copy regardless of whether the email exists
- [ ] Silent refresh fires on app foreground when access token is within 60 seconds of expiry
- [ ] Silent refresh failure navigates to login and clears secure store
- [ ] Logout clears secure store, calls `POST /auth/logout`, and navigates to login
- [ ] Cold app start with valid stored tokens restores session without login screen
- [ ] Cold app start with expired refresh token routes to login screen

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Token storage | expo-secure-store | OS Keychain/Keystore — hardware-backed, inaccessible to other apps; see ADR 0025 |
| Forgot password reset form | Browser-based | Mobile does not handle reset URL in V1; deep linking is V2 |
| Foreground refresh trigger | AppState `active` event | Access tokens can expire while app is suspended; pre-request check alone is insufficient |
| Logout clears local DB? | No — data remains | Re-populating on next login is slower; local data is per-account and encrypted |

---

## Out of scope

- Deep linking for email verification → opens browser in V1; V2 routes directly into app
- Deep linking for password reset → opens browser in V1; V2 routes directly into app
- OAuth sign-in → V2
- "Remember me" persistent session → V2 (web spec already defers this)
- Biometric unlock → V2
