# Forgot Password (OTP reset)

**Area:** Auth
**Routes:** `/forgot-password`, `/reset-password` (web + mobile)
**Endpoints:** `POST /auth/forgot-password`, `POST /auth/reset-password`
**Status:** Spec'd, ready to build
**Last updated:** 2026-07-06

---

## Overview

Lets an Owner who has forgotten their password recover access with a **6-digit one-time code** emailed to them — the same OTP mechanism as email verification ([ADR 0037](../../adr/0037-email-verification-otp.md)), reused for password reset by [ADR 0038](../../adr/0038-password-reset-otp.md). The entire flow completes **in-app on mobile** (no browser bounce, no reset link) and on-screen on web.

The flow has two steps, one per endpoint:

1. **Request** — the Owner enters their email; the server emails a code. The request response is identical whether or not the email is registered (enumeration-safe).
2. **Reset** — the Owner enters the code plus a new password; the server validates the code, sets the password, revokes all existing sessions, and signs the Owner straight in.

This supersedes the link-based reset previously specced in [`../mobile-app/auth.md`](../mobile-app/auth.md) (UC-MOB-AUTH-4), which was never built — see ADR 0038 Context.

---

## API

### `POST /auth/forgot-password`

Request a reset code. **Always 200**, regardless of whether the email exists — it must not disclose account state (mirrors `POST /auth/verify-email/resend`, ADR 0037).

**Request body** (`forgotPasswordSchema`): `{ email }` — trimmed, lowercased, validated as an email.

**Behaviour:**
- Unknown email → silent no-op, still 200.
- Registered email (verified **or** unverified) → generate a fresh 6-digit code (CSPRNG, 10-minute expiry, 4 attempts), store it hashed in the password-reset columns, and email the plaintext code. Re-hitting the endpoint replaces the prior code (this is the "resend").

**Response:** `200 { message }` — generic ("If that account exists, a reset code is on its way.").

### `POST /auth/reset-password`

Validate a code and set a new password. Lookup is **by email**.

**Request body** (`resetPasswordSchema`): `{ email, code, newPassword, confirmPassword }` — `code` is exactly 6 digits; `newPassword` reuses the **exact same Zod password rule as `registerSchema`** (≥ 8 chars, ≥ 1 letter, ≥ 1 digit, ≤ 128 chars, **never trimmed** — spaces are valid password characters), and `confirmPassword` must match. The password rule is **extracted into one shared schema field** and referenced by both `registerSchema` and `resetPasswordSchema` so the two can never drift — a reset must not be allowed to set a password that registration would have rejected, or vice versa.

**Behaviour** (see ADR 0038 §5–§6):
- No such user, no active reset code, expired, or exhausted → `400 { error: "code_expired" }`.
- Wrong code, attempts remain → decrement, `400 { error: "invalid_code" }`.
- Wrong code, last attempt → burn the code (clear it), `400 { error: "code_expired" }`.
- Correct code → set the new password (bcrypt), mark the account `emailVerified`, **revoke all the user's refresh tokens**, mint a fresh session, and clear the reset columns. Return `200` with the session (same shape as login/verify-email; mobile also gets `refreshToken` in the body).

**Enumeration safety:** unknown email is folded into `code_expired`, indistinguishable from a genuinely expired code.

---

## Screens

### Request screen — `/forgot-password`

Email entry. The Owner types their email and taps **Send reset code**. On the endpoint's 200 (always), the client navigates to the reset screen carrying the email, and shows enumeration-safe confirmation copy ("If an account exists for that email, we've sent a code"). A network/5xx failure shows a generic retry error and stays put.

### Reset screen — `/reset-password`

Reached carrying the `email`. A 6-digit code input plus a new-password field (with confirm). On **Reset password**:
- `200` → store the returned session and route by account status (`routeForAccountStatus`: `ONBOARDING` → onboarding, `ACTIVE` → garage), exactly like verify-email.
- `400 invalid_code` → inline "that code isn't right — try again", stays on the screen.
- `400 code_expired` → inline "that code has expired — request a new one", surfacing a way back to the request screen.
- A "Didn't get a code? / Resend" affordance re-requests via `POST /auth/forgot-password`.

Both clients wire their login screen's existing **"Forgot password?"** control to `/forgot-password`.

---

## Use Cases

Shared across web and mobile. The mobile spec's UC-MOB-AUTH-4 is amended to point here.

### UC-AUTH-FP-1 — Owner requests a reset code

**Actor:** Owner who has forgotten their password
**Precondition:** On the login screen; taps "Forgot password?".

1. Client navigates to `/forgot-password`.
2. Owner enters their email and submits.
3. Client calls `POST /auth/forgot-password`.
4. On 200 (always), client navigates to `/reset-password` carrying the email and shows enumeration-safe confirmation copy.
5. A registered Owner receives an email with a 6-digit code (10-minute expiry); an unregistered email receives nothing (no disclosure).

### UC-AUTH-FP-2 — Owner completes the reset

**Actor:** Owner
**Precondition:** On `/reset-password` with a code in their inbox.

1. Owner enters the code and a new password (confirmed) and submits.
2. Client calls `POST /auth/reset-password`.
3. On 200: the server has set the password, verified the account, revoked all prior sessions, and returned a fresh session. The client stores it and routes by account status — the Owner is signed in.
4. On `invalid_code`: inline retry error, stays on the screen (an attempt was consumed).
5. On `code_expired` (expired or burned after 4 wrong attempts): inline error prompting a new request, with a path back to the request step.

### UC-AUTH-FP-3 — Owner resends a code

**Actor:** Owner
**Precondition:** On `/reset-password`; code missing/expired.

1. Owner taps "Resend".
2. Client calls `POST /auth/forgot-password` with the same email.
3. Always succeeds; shows a "new code sent" confirmation and re-arms the field.

---

## Acceptance Criteria

### API

- [ ] `POST /auth/forgot-password` returns 200 for both registered and unknown emails, with identical body
- [ ] A registered email (verified or unverified) gets a fresh hashed reset code with a 10-minute expiry and 4 attempts; re-requesting replaces the prior code
- [ ] An unknown email is a silent no-op (no email sent, no error)
- [ ] `POST /auth/reset-password` with the correct code sets the new password, marks the account verified, deletes all the user's refresh tokens, and returns a fresh session (mobile body includes `refreshToken`)
- [ ] Wrong code with attempts remaining → `400 invalid_code` and the attempt counter decrements
- [ ] Wrong code on the final attempt → code burned, `400 code_expired`
- [ ] Expired / no-active-code / unknown-email → `400 code_expired`
- [ ] `confirmPassword` mismatch and weak passwords are rejected at the validation boundary
- [ ] Service and route handlers have Vitest unit tests for the happy path and every guard clause

### Mobile (Appium)

- [ ] "Forgot password?" on login opens `/forgot-password`
- [ ] Submitting an email navigates to `/reset-password` and shows confirmation copy
- [ ] Correct code + valid new password signs the Owner in and routes by account status (happy path)
- [ ] `invalid_code` and `code_expired` inline errors render
- [ ] ViewModels are unit-tested for all state transitions and error paths

### Web (Cypress)

- [ ] "Forgot password?" on login navigates to `/forgot-password`
- [ ] Submitting an email advances to `/reset-password` with confirmation copy
- [ ] Correct code + valid new password signs in and routes by account status
- [ ] `invalid_code` and `code_expired` error states render
- [ ] Page titles set per route

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Mechanism | 6-digit OTP, in-app both clients | ADR 0038 — reuses ADR 0037's OTP idiom; no mobile browser bounce, no deep-linking dependency |
| Two endpoints, no separate resend | `forgot-password` (request = resend) + `reset-password` | Re-requesting simply replaces the prior code; a third endpoint would add nothing |
| Separate reset columns | `passwordResetCode*` distinct from `verificationCode*` | Two codes can be live at once; conflating them lets one flow clobber the other (ADR 0038 §3) |
| Post-reset | Auto-sign-in + revoke all other sessions + mark verified | Smoothest recovery, consistent with verify-email; reset evicts other sessions and rescues never-verified accounts (ADR 0038 §6) |
| Enumeration safety | `forgot-password` always 200; `reset-password` folds unknown-email into `code_expired` | No cleaner an oracle than register's 409 / verify's slugs |

---

## V2+ / Out of scope

- **Per-email rate-limiting** of reset requests (anti email-bombing) — a shared hardening follow-up with ADR 0037's resend; not a V1 blocker (ADR 0038 Consequences).
- **Deep linking** a reset into the app — not needed; the OTP flow is fully in-app. The V2 deep-linking note in `mobile-app/auth.md` no longer applies to reset.
