# Registration API Spec

**Area:** Auth  
**Status:** Planned  
**Last updated:** 2026-06-06

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

### Password rules

Validated by the shared `registerSchema` in `packages/domain` (see [ADR 0010](../../adr/0010-zod-validation.md)):

- Minimum 8 Unicode code points (not bytes)
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
| 200 | `{ "accessToken": "...", "user": { "id": "...", "accountId": "...", "role": "owner" } }` | Token valid — user auto-signed in |
| 400 | `{ "error": "Invalid or expired verification token" }` | Token not found, already used, or past expiry |
| 500 | `{ "error": "Internal server error" }` | Unexpected failure |

On a 200 response, the server also sets the refresh token as a cookie:

```
Set-Cookie: refreshToken=<token>; HttpOnly; Secure; SameSite=Strict; Path=/
```

No `Max-Age` — session cookie only (expires on browser close). See [ADR 0002](../../adr/0002-custom-jwt-auth.md).

### Token validation logic

1. Look up `User` where `verificationToken = ?` AND `verificationTokenExpiresAt > now()`
2. If not found → 400
3. If found:
   - Set `emailVerified = true`
   - Clear `verificationToken` and `verificationTokenExpiresAt` (set to `null`)
   - Issue access token (15 min, payload: `sub`, `accountId`, `role`)
   - Issue refresh token (session cookie, payload: `sub` only)
4. Return 200 with access token and minimal user payload

### Client behaviour after 200

The web app receives the access token, stores it in memory (React state), and applies the post-login routing logic from UC-AUTH-1 step 5:
- 0 vehicles in Garage → redirect to Onboarding wizard
- 1+ vehicles → redirect to Garage

### Client behaviour after 400

The `/verify-email` screen shows an error state with a "Resend verification email" button. The resend endpoint is out of scope for this spec.

---

## Acceptance Criteria

- [ ] `POST /auth/register` with valid body creates one Account row and one User row in a single transaction
- [ ] `POST /auth/register` with valid body sends an email to the provided address (verifiable in MailHog during dev)
- [ ] `POST /auth/register` with an already-registered email returns 409
- [ ] `POST /auth/register` with invalid body (short password, mismatched passwords, missing field) returns 400 with Zod details
- [ ] `POST /auth/register` does not reveal whether an email exists (UI shows same message for 400 and 409)
- [ ] `GET /auth/verify-email?token=<valid>` returns 200, sets refresh cookie, returns access token
- [ ] `GET /auth/verify-email?token=<valid>` marks the User as `emailVerified: true` and clears the token fields
- [ ] `GET /auth/verify-email?token=<expired>` returns 400
- [ ] `GET /auth/verify-email?token=<invalid>` returns 400
- [ ] `GET /auth/verify-email?token=<already-used>` returns 400 (token cleared after first use)

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Verification token type | `crypto.randomUUID()` stored on User row | Single-use, overwritable on resend, no extra table — see grilling session notes |
| Token expiry | 24 hours | Standard industry default; long enough to survive "I'll do it later", short enough to limit exposure |
| Account creation | Atomic Prisma transaction with User | Registration cannot leave an orphaned Account or User |
| Account type on creation | `PERSONAL` | Only type supported in V1; field present for non-breaking V2 extension |
| Error granularity | 400 vs 409 server-side, catch-all UI | API is correct; UI hides specifics to avoid enumeration |

---

## Out of scope

- Resend verification email endpoint
- Forgot password flow (see [`forgot-password.md`](./forgot-password.md) when created)
- OAuth registration (V2)
- Rate limiting on registration endpoint (V2)
