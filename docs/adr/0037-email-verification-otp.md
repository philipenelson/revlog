# Email verification via one-time code (OTP)

## Context

Registration issues a random UUID `verificationToken`, stores it on the `User` with a 24h expiry, and emails a **link** (`GET /auth/verify-email?token=…`). Clicking the link validates the token and auto-signs the User in (see `docs/specs/auth/register-api.md`, `docs/specs/auth/verify-email.md`).

This works on the web — a link tapped in a desktop mail client lands on the web app, which reads `?token=` and completes verification. It **does not work on mobile**:

1. A verification link tapped in a phone's mail client opens the system browser, **not** the app. Routing it back into the app requires deep linking / Universal Links, which is explicitly deferred to V2 (`docs/specs/mobile-app/navigation.md` — Out of scope).
2. Consequently the mobile `verify-email` screen was never built (it is a `ScreenPlaceholder`), and mobile registration pushes the User to a dead end: the only way to finish verifying is to leave for a browser, verify there, return to the app, and log in again.

The app has already committed to **online + one-time-code confirmation** as its idiom for sensitive operations (`docs/specs/user/user-api.md`, `apps/mobile/domain/repositories/ProfileRepository.ts` — name/email/password changes are "online, OTP-confirmed flows"). Extending that same idiom to registration confirmation closes the mobile loop entirely in-app, with no deep linking, and keeps mobile auth to a single confirmation modality.

The question is whether to add OTP **alongside** the link (mobile uses OTP, web keeps the link) or to **unify** on OTP and retire the link everywhere.

## Decision

Replace link-based email verification with a **6-digit numeric one-time code (OTP)**, entered in-app on mobile and on-screen on web. **The link mechanism is retired** — OTP is the single verification mechanism for both clients. Unifying (rather than running two mechanisms in parallel) avoids carrying two code paths, two email templates, and two sets of tests indefinitely; the web link flow is pre-launch and cheap to migrate now.

### 1. Code generation & parameters

| Parameter | Value |
|---|---|
| Format | 6 numeric digits (`000000`–`999999`), zero-padded |
| Generation | CSPRNG — `crypto.randomInt(0, 1_000_000)` |
| Expiry | **10 minutes** from issue |
| Attempts | **4 total** (1 + 3 retries). The 5th submission of a wrong code never happens — the 4th wrong attempt **burns** the code (clears it), forcing a resend |
| At rest | Stored **hashed** (bcrypt, the same `BCRYPT_ROUNDS` as passwords). The plaintext code lives only in the email |

Hashing the code is defence-in-depth for data-at-rest (a DB leak reveals no live codes); the **attempt cap is the primary brute-force defence** — 4 guesses against a 1-in-1,000,000 space is a negligible success probability, and the cap holds regardless of hash speed.

### 2. Verify — `POST /auth/verify-email`

Body `{ email, code }` (replacing the old `GET …?token=`). The server looks the User up **by email** (a 6-digit code is not globally unique), then:

- No such User, already verified, no active code, or code expired → generic failure (see §4).
- `bcrypt.compare(code, hash)` matches → mark verified, clear the code fields, issue a session (same `VerifyEmailResult` shape as before: access token + refresh token + `user` + `account`). This is unchanged from today — verification still auto-signs the User in.
- Mismatch → decrement `verificationAttemptsRemaining`; when it reaches 0, clear the code (burn).

### 3. Resend — `POST /auth/verify-email/resend`

Body `{ email }`. Generates a fresh code, resets the expiry and the attempt counter, and re-sends the email. **Always returns 200** regardless of whether the email is registered or already verified — it must not become an account-enumeration oracle. An unknown or already-verified email is a silent no-op.

### 4. Failure responses & enumeration safety

`POST /auth/verify-email` returns `400` with a short machine-readable slug the client maps to copy:

| Slug | When | Client copy (intent) |
|---|---|---|
| `invalid_code` | Wrong code, attempts still remain | "That code isn't right — check it and try again." |
| `code_expired` | Expired, exhausted, no active code, **or unknown email** | "That code has expired. Request a new one." + surface Resend |

Folding *unknown email* into `code_expired` (indistinguishable from a legitimately expired code) keeps verify from becoming a cleaner enumeration oracle than registration already is (register returns `409` on a duplicate email). The two slugs exist for **UX** — telling the User whether to retry or to resend — not to reveal account state.

### 5. Data model

The `User` verification columns change (Prisma migration; no production data pre-launch):

```
- verificationToken           String?
- verificationTokenExpiresAt  DateTime?
+ verificationCodeHash          String?
+ verificationCodeExpiresAt     DateTime?
+ verificationAttemptsRemaining Int?
```

All three are nullable and set together at registration / resend, and cleared together on successful verification or attempt-burn. `IUserRepository` loses `findByVerificationToken` and gains `setVerificationCode(id, {...})` and `consumeVerificationAttempt(id)` (decrement, burning at 0); `markVerified` additionally clears the code fields. Lookup on the verify path reuses the existing `findByEmail`.

### 6. Email

`sendVerificationEmail(to, code)` sends the **code**, not a link: "Your Revlog verification code is **123456**. It expires in 10 minutes." Subject unchanged (`Verify your Revlog account`). The `appUrl` argument is dropped.

### 7. Client surface

- `packages/domain` — new `verifyEmailSchema` (`{ email, code: /^\d{6}$/ }`) and `resendVerificationSchema` (`{ email }`).
- `packages/api-client` — `verifyEmail(client, { email, code })` (POST) and `resendVerification(client, { email })` replace the old GET-based `verifyEmail(client, token)`.
- **Web** `verify-email` screen becomes a code-entry form (email carried as a query param from registration; no `?token=`). Its auto-verify-on-mount effect and the `?token=` handling are removed.
- **Mobile** `verify-email` screen is built for the first time: a code-entry form that, on success, stores the session and routes by account status (`ONBOARDING` → `/onboarding`).

## Consequences

- Mobile registration completes **entirely in-app** — no browser bounce, no deep linking, no V2 dependency.
- One verification mechanism, one email template, one set of endpoints across both clients.
- The web verify flow changes shape (form, not auto-verifying link target); its spec sections and Cypress E2E are updated accordingly.
- Codes are low-entropy by design; the security rests on the **attempt cap + short expiry + hashed-at-rest**, not on the secrecy of a long token. Resend is currently unthrottled beyond replacing the prior code — per-email **rate-limiting of resend** (anti email-bombing) is a noted hardening follow-up, not a V1 blocker.

## Alternatives considered

- **Keep the link on web, add OTP only for mobile.** Least disruptive to shipped web code, but leaves two verification mechanisms, two email templates, and two test suites to maintain forever. Rejected in favour of retiring the link now while it is still pre-launch.
- **Magic-link with deep linking on mobile.** Would preserve the link model, but requires Universal Links / App Links plumbing that is explicitly V2, and still forces a context switch out of and back into the app. Rejected.
- **Longer/alphanumeric code.** More entropy per code, but worse to type on a phone; the attempt cap already makes 6 digits safe. Rejected for UX.
