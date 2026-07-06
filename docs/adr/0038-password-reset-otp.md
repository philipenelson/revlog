# Password reset via one-time code (OTP)

## Context

Both clients' login screens link to a "Forgot password?" destination that was never built. The web login renders `<a href="/forgot-password">` pointing at a route that does not exist; the mobile login pushes `/(auth)/forgot-password`, which today is a `ScreenPlaceholder`. There is no `POST /auth/forgot-password`, no reset endpoint, no reset columns on `User`, and no `docs/specs/auth/forgot-password.md` — the flow is entirely greenfield.

The only place password reset was ever designed is `docs/specs/mobile-app/auth.md` — UC-MOB-AUTH-4, which specced a **link-based** reset: the Owner enters their email on mobile, receives a reset **link** by email, taps it to complete the reset **in the browser**, then returns to the app to log in with the new password.

That design has the exact defect [ADR 0037](0037-email-verification-otp.md) removed from email verification:

1. A reset link tapped in a phone's mail client opens the system browser, **not** the app. Routing back into the app requires deep linking / Universal Links, which is explicitly V2 (`docs/specs/mobile-app/navigation.md` — Out of scope).
2. It forces a context switch out of and back into the app, and requires a browser-based reset form (the web reset screen, also unbuilt) to exist as the single completion surface for both clients.

The app has already committed to **online + one-time-code confirmation** as its idiom for sensitive operations (ADR 0037 for registration; `docs/specs/user/user-api.md` records name/email/password changes as "online, OTP-confirmed flows"). Password reset is the canonical sensitive operation. Building it link-based would resurrect the mobile dead-end ADR 0037 just retired and split the flow across a browser hand-off.

Because neither client's forgot-password flow is implemented, there is **nothing to migrate** — the link design can be replaced before it ships.

## Decision

Reset a forgotten password with a **6-digit numeric one-time code (OTP)**, entered in-app on mobile and on-screen on web — the same mechanism and parameters as email verification (ADR 0037). The link-based reset design in `docs/specs/mobile-app/auth.md` (UC-MOB-AUTH-4) is **superseded before implementation**; no reset link is ever sent.

### 1. Two endpoints

| Endpoint | Body | Purpose |
|---|---|---|
| `POST /auth/forgot-password` | `{ email }` | Issue (or re-issue) a reset code and email it. **Always 200**, enumeration-safe. Re-requesting is the resend — there is no separate resend endpoint. |
| `POST /auth/reset-password` | `{ email, code, newPassword }` | Validate the code, set the new password, invalidate existing sessions, and **auto-sign-in** (return a fresh session). |

Lookup on both paths is **by email** — a 6-digit code is not globally unique (identical to ADR 0037's verify path).

### 2. Code generation & parameters

Identical to ADR 0037 — the OTP mechanism is deliberately shared:

| Parameter | Value |
|---|---|
| Format | 6 numeric digits (`000000`–`999999`), zero-padded |
| Generation | CSPRNG — `crypto.randomInt(0, 1_000_000)` |
| Expiry | **10 minutes** from issue |
| Attempts | **4 total** (1 + 3 retries). The 4th wrong attempt **burns** the code (clears it), forcing a fresh request |
| At rest | Stored **hashed** (bcrypt, the same `BCRYPT_ROUNDS` as passwords). The plaintext code lives only in the email |

As in ADR 0037, the **attempt cap is the primary brute-force defence** — 4 guesses against a 1-in-1,000,000 space is negligible; hashing-at-rest is defence-in-depth for a DB leak.

### 3. Separate columns from email verification

The reset code uses its **own** `User` columns, distinct from the verification columns (Prisma migration; no production data pre-launch):

```
+ passwordResetCodeHash          String?
+ passwordResetCodeExpiresAt     DateTime?
+ passwordResetAttemptsRemaining Int?
```

Reusing the verification columns would conflate two different purposes: a pending verification code could be consumed by the reset path (and vice versa), and a reset request would clobber an in-flight verification. Two independent codes may legitimately be live at once (an unverified user who requests a reset), so they need independent storage. All three columns are nullable and set/cleared together, exactly like the verification triplet.

### 4. `POST /auth/forgot-password` — enumeration safety

Generates a fresh code, sets the expiry and attempt counter, and emails the code. **Always returns 200** regardless of whether the email is registered — an unknown email is a silent no-op. It must never become an account-enumeration oracle. It issues a code for a registered user **whether or not they are verified** (see §6). Re-hitting the endpoint simply replaces the prior code — this is how the client "resends".

### 5. `POST /auth/reset-password` — failure responses

Returns `400` with the same machine-readable slugs as verify-email, which the client maps to copy:

| Slug | When | Client copy (intent) |
|---|---|---|
| `invalid_code` | Wrong code, attempts still remain | "That code isn't right — check it and try again." |
| `code_expired` | Expired, exhausted, no active code, **or unknown email** | "That code has expired. Request a new one." + surface a way back to request one |

Folding *unknown email* into `code_expired` keeps reset no cleaner an enumeration oracle than forgot-password's blanket 200. The two slugs exist for **UX** (retry vs. request-a-new-one), not to reveal account state.

### 6. Post-reset: session invalidation, auto-sign-in, and verification

On a correct code, in order:

1. **Set the new password** (`bcrypt` hash) and clear the three reset columns.
2. **Mark the account verified** if it was not already. A valid emailed OTP proves control of the inbox — precisely what email verification establishes — so a successful reset satisfies verification in the same step. This closes the otherwise-inconsistent case of issuing a session to an unverified user (login requires `emailVerified`), and gives an unverified user a single path back in. It is not a security downgrade: verify-email and reset-password both gate on an emailed OTP.
3. **Revoke all of the user's refresh tokens** (`deleteAllForUser`). A password reset should evict every existing session — other devices, and any session an attacker may hold — before a new one is minted.
4. **Issue a fresh session** for the resetting client and return it (access token + refresh token + `user` + `account`), the same `SessionResult` shape as login/verify-email. The reset client is **auto-signed-in**, mirroring verify-email; it is unaffected by the revocation in step 3 because its token is created after.

### 7. Data model & repositories

`IUserRepository` gains:
- `setPasswordResetCode(id, { codeHash, expiresAt, attemptsRemaining })` — set the three reset columns (forgot-password / re-request).
- `decrementPasswordResetAttempt(id)` — atomically decrement (wrong code, attempts remain).
- `clearPasswordResetCode(id)` — null all three (attempt-burn).
- `resetPassword(id, passwordHash)` — set `passwordHash`, set `emailVerified = true`, and null all three reset columns, atomically.

`IRefreshTokenRepository.deleteAllForUser(userId)` already exists and is reused. The verify path's `findByEmail` is reused for lookup.

### 8. Email

`sendPasswordResetEmail(to, code)` sends the **code**: "Your Revlog password reset code is **123456**. It expires in 10 minutes." Subject: `Reset your Revlog password`. A distinct template from verification so the two emails are never confused.

### 9. Client surface

- `packages/domain` — `forgotPasswordSchema` (`{ email }`) and `resetPasswordSchema` (`{ email, code: /^\d{6}$/, newPassword, confirmPassword }`, with the same password rules as `registerSchema` and a `confirmPassword` match refinement).
- `packages/api-client` — `forgotPassword(client, { email })` and `resetPassword(client, { email, code, newPassword })` (the latter returns a `Session`).
- **Mobile** — a two-screen flow: `forgot-password` (email entry → request code → navigate to reset carrying the email) and a new `reset-password` screen (code + new password → auto-sign-in, routed by account status). Built with `tokenHttpClient` as online-only ops, like login/register/verify-email.
- **Web** — `/forgot-password` (email entry) and `/reset-password` (code + new password) screens, wiring the login screen's existing dead `Forgot password?` link.
- Both clients' login "Forgot password?" links now open the in-app OTP flow.

## Consequences

- Password reset completes **entirely in-app** on mobile — no browser bounce, no deep linking, no V2 dependency — matching registration (ADR 0037).
- One OTP mechanism and parameter set now covers registration verification **and** password reset; only the columns, the email template, and the endpoints differ.
- A successful reset logs the user out everywhere else and verifies them, giving a single, secure recovery path that also rescues never-verified accounts.
- Reset codes are low-entropy by design; security rests on the **attempt cap + short expiry + hashed-at-rest + all-session revocation**, not on the secrecy of a long token.
- `forgot-password` is unthrottled beyond replacing the prior code. Per-email **rate-limiting** of reset requests (anti email-bombing) is a shared hardening follow-up with ADR 0037's resend, not a V1 blocker.
- `docs/specs/mobile-app/auth.md` UC-MOB-AUTH-4 and its Decisions/Out-of-scope entries are amended to the OTP flow (dated amendment, per the repo's "amend, don't rewrite" convention).

## Alternatives considered

- **Link-based reset (the superseded UC-MOB-AUTH-4).** The originally-specced design. Rejected for the reasons in Context — it reintroduces the mobile browser dead-end ADR 0037 removed and requires a separate browser reset form. Cheap to drop now, pre-launch.
- **Reuse the email-verification OTP columns.** Fewer columns, but conflates two distinct codes that can be live simultaneously; a reset would clobber a pending verification. Rejected — separate columns are cheap and keep the two flows independent (§3).
- **Return the user to the login screen after reset (no auto-sign-in).** Simpler, and forces the user to re-type the new password once. Rejected in favour of auto-sign-in for consistency with verify-email and a smoother recovery; all other sessions are still revoked either way.
- **Longer / alphanumeric reset code.** More entropy per code, but worse to type on a phone; the attempt cap already makes 6 digits safe. Rejected for UX, identical to ADR 0037's reasoning.
