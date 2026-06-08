# Login API Spec

**Area:** Auth
**Status:** Implemented
**Last updated:** 2026-06-08

---

## Overview

Backend implementation for UC-AUTH-1 (Sign in with email and password) from [`docs/specs/auth/login.md`](./login.md):

- `POST /auth/login` — validates credentials, issues a session for a verified Account

This endpoint completes the session-issuance trio alongside `POST /auth/register` and `GET /auth/verify-email` (see [register-api.md](./register-api.md)) — all three end with the same shape of response so the client can apply one routing rule regardless of which path got the User there. Authentication uses custom JWT via `jose` and `bcrypt` (see [ADR 0002](../../adr/0002-custom-jwt-auth.md)). Validation uses Zod schemas from `packages/domain` (see [ADR 0010](../../adr/0010-zod-validation.md)). Token issuance and refresh-cookie mechanics are identical to `verifyEmail`'s — see [ADR 0012](../../adr/0012-refresh-token-storage.md).

---

## POST /auth/login

### Request

```
POST /auth/login
Content-Type: application/json
```

```json
{
  "email": "string — valid email format",
  "password": "string — non-empty"
}
```

### Input sanitization

Applied by `loginSchema` in `packages/domain` before the service receives any data:

| Field | Transform |
|---|---|
| `email` | Trim whitespace, normalize to lowercase — must match the canonical form `registerSchema` already stored (`Test@Example.COM` → `test@example.com`); without this, a User who typed their email in a different case at registration than at login would get a false "wrong credentials" |
| `password` | **Not trimmed** — spaces in passwords are intentional and valid |

### Responses

| Status | Body | When |
|---|---|---|
| 200 | `{ "accessToken": "...", "user": { "id": "...", "accountId": "...", "role": "owner" }, "account": { "id": "...", "status": "ONBOARDING" \| "ACTIVE" } }` | Credentials valid, email verified — session issued |
| 400 | `{ "error": "Invalid input", "details": [...] }` | Zod validation failure (empty email/password, malformed email) |
| 401 | `{ "error": "Invalid email or password" }` | No User with that email, wrong password, **or** account not yet email-verified |
| 500 | `{ "error": "Internal server error" }` | Unexpected failure |

On a 200 response, the server sets the refresh token as a cookie — identical to `GET /auth/verify-email`:

```
Set-Cookie: refreshToken=<token>; HttpOnly; Secure; SameSite=Strict; Path=/
```

No `Max-Age` — session cookie (expires on browser close). The `RefreshToken` DB record carries a 7-day `expiresAt` enforced server-side.

**Note:** The web client displays a single catch-all message for 401 (per UC-AUTH-1's error strategy: *"Couldn't sign you in. Check your email and password — or your inbox if you haven't confirmed your account yet."*). The three distinct underlying causes (no such User, wrong password, unverified) are deliberately collapsed into one status and one message — see "Decisions" below.

### Side effects

1. Look up `User` by (sanitized) email
2. Verify the supplied password against `passwordHash` with `bcrypt.compare`
3. Confirm `emailVerified === true`
4. Issue access token (`signAccessToken` — stateless JWT, 15 min TTL, payload `sub`, `accountId`, `role`) and refresh token (`generateRefreshToken` — opaque `crypto.randomBytes(32)`; SHA-256 hash persisted to `RefreshToken` with a 7-day `expiresAt`; raw value placed in the cookie)
5. Look up the User's Account and include `id` and `status` in the response, exactly as `verifyEmail` does — the client needs it to apply the routing rule from UC-AUTH-1 step 5 without an extra round trip

### Client behaviour after 200

Identical to `GET /auth/verify-email`'s documented client behaviour: store the access token in memory (React state, never `localStorage` — [ADR 0002](../../adr/0002-custom-jwt-auth.md)), then route by `account.status`:
- `"ONBOARDING"` → Onboarding wizard
- `"ACTIVE"` → Garage

### Client behaviour after 401 / 400

The `/login` screen shows the single catch-all inline error message defined in [login.md](./login.md#uc-auth-1--sign-in-with-email-and-password) below the form (not a toast). A 5xx is shown with the separate service-error message — the two-tier messaging strategy [login.md](./login.md) documents under "Decisions".

---

## Acceptance Criteria

- [x] `POST /auth/login` with valid, verified credentials returns 200, sets the refresh cookie, and returns `{ accessToken, user, account }`
- [x] `POST /auth/login` returns 401 when no User exists for the given email
- [x] `POST /auth/login` returns 401 when the password does not match
- [x] `POST /auth/login` returns 401 when the User exists, the password matches, but `emailVerified` is `false`
- [x] All three 401 cases return the exact same status and body — the client cannot distinguish them, and must not be able to (no enumeration)
- [x] `POST /auth/login` with invalid body (missing field, malformed email) returns 400 with Zod details
- [x] `POST /auth/login` normalizes email case before lookup — `Test@Example.COM` matches an account registered as `test@example.com`
- [x] `POST /auth/login` response includes `account: { id, status }` so the client can apply the post-login routing rule (see [ADR 0015](../../adr/0015-account-status-state-machine.md))
- [x] Issued access token payload matches the `verifyEmail`-issued shape (`sub`, `accountId`, `role`)
- [x] Refresh token cookie attributes match `verifyEmail`'s exactly (`HttpOnly`, `Secure` in production, `SameSite=Strict`, `Path=/`, no `Max-Age`)

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Single 401 for "no such user," "wrong password," and "unverified" | Same status, same body, same message for all three | Distinguishing them would let an attacker enumerate registered emails and verification status — the exact reasoning [login.md](./login.md) already applies to its catch-all error copy ("Don't reveal which field is wrong"); this endpoint is where that policy is enforced server-side, not just worded client-side |
| Reuse `verifyEmail`'s token-issuance code path | Same `signAccessToken` + `generateRefreshToken` + `refreshTokenRepo` calls, same cookie options | Two independently-written "issue a session" implementations would drift — a bug fixed in one path (e.g., a TTL change, a cookie attribute) could silently miss the other. One path, two callers |
| Email case sanitization added to `loginSchema` | `.trim().toLowerCase()`, matching `registerSchema` | `registerSchema` already canonicalizes email before storage; `loginSchema` did not canonicalize before this endpoint was built, which would have produced a false "wrong credentials" for any User who logged in with different casing than they registered with — an input-handling bug per the root `CLAUDE.md` rule that "All string input from external sources... must be sanitized at the validation boundary" |
| Response shape matches `verifyEmail`'s | `{ accessToken, user: { id, accountId, role }, account: { id, status } }` | The client applies one `routeForAccountStatus(account.status)` rule regardless of which of the three session-issuing endpoints (`register` doesn't issue one; `verifyEmail`, `login`, and — in V2 — `refresh` do) produced the session. A different shape here would force the client to branch on "which endpoint did I just call" |

---

## Out of scope

- `POST /auth/refresh` and token rotation (tracked separately — "Token rotation on refresh" in [`v1.md`](../../milestones/v1.md))
- `POST /auth/logout`
- "Remember me" / persistent sessions (V2 — see [login.md](./login.md#v2-roadmap-items))
- Rate limiting on the login endpoint (V2, same rationale as [register-api.md](./register-api.md)'s rate-limiting deferral)
- OAuth sign-in (UC-AUTH-6, V2)
