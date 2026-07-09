# Registration API Spec

**Area:** Auth  
**Status:** Implemented — **verification mechanism amended 2026-07-06 (see [Update — OTP verification](#update-2026-07-06--otp-verification-adr-0037) at the bottom)**  
**Last updated:** 2026-07-06

---

## Overview

Backend implementation for UC-AUTH-2 (Create an account) and UC-AUTH-3 (Verify email) from [`docs/specs/auth/login.md`](./login.md). Two endpoints:

- `POST /auth/register` — creates an Account + User, sends verification email
- `GET /auth/verify-email` — validates the token and auto-signs the user in

Authentication uses custom JWT via `jose` and `bcrypt` (see [ADR 0002](../../adr/0002-custom-jwt-auth.md)). Validation uses Zod schemas from `packages/domain` (see [ADR 0010](../../adr/0010-zod-validation.md)). Email is sent via Nodemailer/SMTP (see [ADR 0011](../../adr/0011-nodemailer-email.md)).

---

## POST /auth/register

### Request

```
POST /auth/register
Content-Type: application/json
```

```json
{
  "fullName": "string — non-empty, max 100 characters",
  "email": "string — valid email format",
  "password": "string — see Password rules below",
  "confirmPassword": "string — must match password"
}
```

### Input sanitization

Applied by Zod transforms in `registerSchema` before the service receives any data:

| Field | Transform |
|---|---|
| `email` | Trim whitespace, normalize to lowercase — ensures canonical uniqueness (`Test@Example.COM` → `test@example.com`) |
| `fullName` | Trim whitespace — `"  John Smith  "` → `"John Smith"` |
| `password` / `confirmPassword` | **Not trimmed** — spaces in passwords are intentional and valid |

The verification token query param (`GET /auth/verify-email?token=…`) is trimmed in the route handler before the service is called, guarding against copy-paste whitespace.

### Password rules

Validated by the shared `registerSchema` in `packages/domain` (see [ADR 0010](../../adr/0010-zod-validation.md)):

- Minimum 8 Unicode code points (not bytes)
- Maximum 128 characters — prevents bcrypt DoS (bcrypt truncates at 72 bytes; 128 is the safe conventional ceiling without revealing the implementation detail)
- At least one Unicode letter (`\p{L}`) — covers Latin, CJK, Arabic, etc.
- At least one Unicode digit (`\p{N}`) — covers full-width and half-width numerals

### Responses

| Status | Body | When |
|---|---|---|
| 201 | `{ "message": "Check your inbox to verify your email." }` | Account created, email sent |
| 400 | `{ "error": "Invalid input", "details": [...] }` | Zod validation failure |
| 409 | `{ "error": "Email already registered" }` | Duplicate email |
| 500 | `{ "error": "Internal server error" }` | Unexpected failure |

**Note:** The web client displays a single catch-all message for both 400 and 409 responses (per UC-AUTH-2 error strategy — do not reveal which field caused the failure). The distinct status codes are for server-side logging and future API consumers.

### Side effects

1. Prisma transaction:
   - Create `Account` (`type: PERSONAL`)
   - Create `User` linked to Account — `emailVerified: false`, `verificationToken: <uuid>`, `verificationTokenExpiresAt: now + 24h`
2. Send verification email to the provided address

### Email content

**Subject:** `Verify your Revlog account`

**Body (plain text):**
```
Hi {fullName},

Click the link below to verify your email address. The link expires in 24 hours.

{APP_URL}/verify-email?token={verificationToken}

If you didn't create a Revlog account, you can ignore this email.
```

---

## GET /auth/verify-email

### Request

```
GET /auth/verify-email?token={verificationToken}
```

### Responses

| Status | Body | When |
|---|---|---|
| 200 | `{ "accessToken": "...", "user": { "id": "...", "accountId": "...", "role": "owner" }, "account": { "id": "...", "status": "ONBOARDING" } }` | Token valid — user auto-signed in |
| 400 | `{ "error": "Invalid or expired verification token" }` | Token not found, already used, or past expiry |
| 500 | `{ "error": "Internal server error" }` | Unexpected failure |

On a 200 response, the server also sets the refresh token as a cookie:

```
Set-Cookie: refreshToken=<token>; HttpOnly; Secure; SameSite=Strict; Path=/
```

No `Max-Age` on the cookie — session cookie (expires on browser close). The corresponding `RefreshToken` DB record has a 7-day `expiresAt` enforced server-side. See [ADR 0002](../../adr/0002-custom-jwt-auth.md) and [ADR 0012](../../adr/0012-refresh-token-storage.md).

### Token validation logic

1. Look up `User` where `verificationToken = ?` AND `verificationTokenExpiresAt > now()`
2. If not found → 400
3. If found:
   - Set `emailVerified = true`
   - Clear `verificationToken` and `verificationTokenExpiresAt` (set to `null`)
   - Issue access token — stateless JWT, 15 min TTL, payload: `sub`, `accountId`, `role`
   - Issue refresh token — opaque random value (`crypto.randomBytes(32)`); SHA-256 hash stored in `RefreshToken` table with `expiresAt` (7 days); raw value placed in cookie (see [ADR 0012](../../adr/0012-refresh-token-storage.md))
   - Look up the User's Account and include its `id` and `status` in the response — the client needs this to apply the post-verification routing rule without an extra round trip (see [ADR 0015](../../adr/0015-account-status-state-machine.md))
4. Return 200 with access token and minimal user + account payload

### Client behaviour after 200

The web app receives the access token, stores it in memory (React state), and applies the post-login routing logic from UC-AUTH-1 step 5 — based on the `account.status` field in this response:
- `account.status === "ONBOARDING"` → redirect to Onboarding wizard
- `account.status === "ACTIVE"` → redirect to Garage

### Client behaviour after 400

The `/verify-email` screen shows an error state with a "Resend verification email" button. The resend endpoint is out of scope for this spec.

---

## Acceptance Criteria

- [x] `POST /auth/register` with valid body creates one Account row and one User row in a single transaction
- [x] `POST /auth/register` with valid body sends an email to the provided address (verifiable in Mailpit at `http://localhost:8025` during dev)
- [x] `POST /auth/register` with an already-registered email returns 409
- [x] `POST /auth/register` with invalid body (short password, mismatched passwords, missing field) returns 400 with Zod details
- [x] `POST /auth/register` does not reveal whether an email exists (UI shows same message for 400 and 409)
- [x] `GET /auth/verify-email?token=<valid>` returns 200, sets refresh cookie, returns access token
- [x] `GET /auth/verify-email?token=<valid>` response includes `account: { id, status }` so the client can apply the post-verification routing rule (see [ADR 0015](../../adr/0015-account-status-state-machine.md))
- [x] `GET /auth/verify-email?token=<valid>` marks the User as `emailVerified: true` and clears the token fields
- [x] `GET /auth/verify-email?token=<expired>` returns 400
- [x] `GET /auth/verify-email?token=<invalid>` returns 400
- [x] `GET /auth/verify-email?token=<already-used>` returns 400 (token cleared after first use)

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Verification token type | `crypto.randomUUID()` stored on User row | Single-use, overwritable on resend; 1:1 with User so no extra table needed |
| Refresh token type | Opaque `crypto.randomBytes(32)`, SHA-256 hash in `RefreshToken` table | DB-backed = truly revocable per session; opaque = no payload leakage; SHA-256 sufficient for high-entropy tokens (see [ADR 0012](../../adr/0012-refresh-token-storage.md)) |
| Token expiry | 24 hours | Standard industry default; long enough to survive "I'll do it later", short enough to limit exposure |
| Account creation | Atomic Prisma transaction with User | Registration cannot leave an orphaned Account or User |
| Account type on creation | `PERSONAL` | Only type supported in V1; field present for non-breaking V2 extension |
| Error granularity | 400 vs 409 server-side, catch-all UI | API is correct; UI hides specifics to avoid enumeration |

---

## Out of scope

- ~~Resend verification email endpoint~~ — now in scope, see the Update below
- Forgot password flow (see [`forgot-password.md`](./forgot-password.md), ADR 0038)
- OAuth registration (V2)
- Rate limiting on registration endpoint (V2)

---

## Update (2026-07-06) — OTP verification (ADR 0037)

Email verification moves from a **link** (`GET /auth/verify-email?token=…`) to a **6-digit one-time code** entered in the client. The link is **retired** for both web and mobile — mobile could never complete a link without deep linking (V2). See [ADR 0037](../../adr/0037-email-verification-otp.md). Everything above this section describes the superseded link mechanism; the contract below is authoritative.

### `POST /auth/register` (changed side effects)

Body and validation are unchanged. What changes is what the transaction stores and what the email carries:

- Generate a 6-digit numeric code via CSPRNG (`crypto.randomInt(0, 1_000_000)`, zero-padded).
- Store `verificationCodeHash` (bcrypt, same rounds as passwords), `verificationCodeExpiresAt = now + 10min`, `verificationAttemptsRemaining = 4`.
- Email the **code** (not a link) — see [Email content](#email-content-otp) below.

Response is unchanged: `201 { "message": "Check your inbox to verify your email." }`.

### `POST /auth/verify-email` (replaces `GET /auth/verify-email`)

**Request**

```
POST /auth/verify-email
Content-Type: application/json
{ "email": "owner@example.com", "code": "123456" }
```

`email` is trimmed + lowercased and `code` matched against `/^\d{6}$/` by `verifyEmailSchema` (`packages/domain`) before the service runs. Malformed input → `400 { "error": "Invalid input", "details": [...] }`.

**Responses**

| Status | Body | When |
|---|---|---|
| 200 | Session body (`accessToken`, `accessTokenExpiresAt`, `user`, `account`; `refreshToken` in body for mobile / cookie for web — via the existing `sessionResponseBody` + `x-client-platform` mechanism) | Code correct — User marked verified and auto-signed in |
| 400 | `{ "error": "invalid_code" }` | Wrong code, attempts still remain (counter decremented) |
| 400 | `{ "error": "code_expired" }` | Expired, attempts exhausted, no active code, **or unknown email** (enumeration-safe) |
| 400 | `{ "error": "Invalid input", "details": [...] }` | Zod validation failure (bad email / non-6-digit code) |
| 500 | `{ "error": "Internal server error" }` | Unexpected failure |

**Verification logic** (lookup is **by email**, since a 6-digit code is not globally unique):

1. `findByEmail(email)`. If no User, already verified, no active code, or `verificationCodeExpiresAt < now` → `code_expired`.
2. `bcrypt.compare(code, verificationCodeHash)`:
   - **Match** → `markVerified` (sets `emailVerified = true`, nulls all three code fields), issue access + refresh token, return session (same `VerifyEmailResult` as the old link path).
   - **Mismatch** → `consumeVerificationAttempt` (decrement; at 0, null the code — **burn**). Return `invalid_code` if attempts remained, else `code_expired`.

The two slugs exist so the client can tell the User to **retry** vs **resend**; folding unknown-email into `code_expired` keeps verify from being a cleaner enumeration oracle than `register` (which already 409s on a duplicate). Copy mapping lives in the client specs.

### `POST /auth/verify-email/resend` (new)

**Request:** `{ "email": "owner@example.com" }` (validated by `resendVerificationSchema`).

**Response:** **always** `200 { "message": "If that account needs verifying, a new code is on its way." }` — regardless of whether the email is registered or already verified (enumeration-safe). For an unverified User it generates a fresh code, resets expiry (`now + 10min`) and attempts (`4`), and re-sends the email; for an unknown/already-verified email it is a silent no-op.

Per-email throttling of resend (anti email-bombing) is a noted hardening follow-up, not a V1 blocker.

### <a id="email-content-otp"></a>Email content (OTP)

**Subject:** `Verify your Revlog account` (unchanged)

```
Hi {fullName},

Your Revlog verification code is:

  {code}

Enter it in the app to verify your email. The code expires in 10 minutes.

If you didn't create a Revlog account, you can ignore this email.
```

### Data model change

`User` verification columns (Prisma migration; no production data pre-launch):

```
- verificationToken           String?
- verificationTokenExpiresAt  DateTime?
+ verificationCodeHash          String?
+ verificationCodeExpiresAt     DateTime?
+ verificationAttemptsRemaining Int?
```

`IUserRepository` drops `findByVerificationToken`; adds `setVerificationCode(id, { codeHash, expiresAt, attemptsRemaining })` and `consumeVerificationAttempt(id)`; `markVerified` additionally clears the code fields.

### Acceptance Criteria (OTP)

- [ ] `POST /auth/register` stores a hashed 6-digit code with a 10-min expiry and 4 attempts, and emails the plaintext code (no link)
- [ ] `POST /auth/verify-email` with the correct code returns 200 + session, marks `emailVerified`, and clears the code fields
- [ ] `POST /auth/verify-email` with a wrong code returns `400 invalid_code` and decrements the attempt counter
- [ ] The 4th wrong attempt burns the code; a subsequent submit (even of the right code) returns `400 code_expired`
- [ ] `POST /auth/verify-email` with an expired code returns `400 code_expired`
- [ ] `POST /auth/verify-email` for an unknown email returns `400 code_expired` (no enumeration signal)
- [ ] `POST /auth/verify-email/resend` returns 200 for any email; for an unverified User it issues a fresh code + resets expiry/attempts and re-sends
- [ ] `POST /auth/verify-email/resend` for an unknown or already-verified email returns 200 and sends nothing

### Decisions (OTP)

| Decision | Choice | Reason |
|---|---|---|
| Code format / lifetime / attempts | 6 numeric digits, 10-min expiry, 4 attempts (1 + 3) | Easy to type on a phone; the attempt cap — not code length — is the brute-force defence (4 guesses in 1e6). See ADR 0037 |
| Code at rest | bcrypt hash | Defence-in-depth; a DB leak reveals no live codes |
| Lookup key on verify | Email, not code | A 6-digit code isn't globally unique — many Users can share `123456` |
| Enumeration on verify | Unknown email → `code_expired` | Same response as a real expired code; no cleaner oracle than `register`'s 409 |
| Resend response | Always 200, no state disclosed | Resend must not reveal whether an email is registered or already verified |
