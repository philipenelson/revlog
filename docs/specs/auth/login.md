# Login / Register Screen Spec

**Route:** `/login`  
**Status:** UI complete, backend integration pending  
**Last updated:** 2026-06-06

---

## Overview

Single-route screen that handles both sign-in and account creation via a tab toggle. Left panel is a static brand panel; right panel contains the active form. Every new user lands here after following a registration link — or is redirected here by middleware when accessing a protected route unauthenticated.

Authentication uses custom JWT via `jose` and `bcrypt` (see [ADR 0002](../../adr/0002-custom-jwt-auth.md)).

---

## Layout

**Split-panel, full viewport:**

| Panel | Width | Content |
|---|---|---|
| Brand (left) | 42%, min 360px | Logo, headline, tagline, 3 feature callouts |
| Form (right) | flex: 1 | Tab switcher + active form + Google button + footer |

On screens narrower than 360px the brand panel collapses (responsive behaviour is a V2 task — the current layout is desktop-first).

---

## Use Cases

### UC-AUTH-1 — Sign in with email and password

**Actor:** Returning User (role: Owner) with a verified Account  
**Precondition:** User exists, Account is active, email is verified  
**Milestones:** [V1](../../milestones/v1.md)

1. User navigates to `/login` (Login tab active by default)
2. Enters email and password
3. Submits the form
4. System validates credentials and issues an access token + refresh token
5. System checks the signed-in User's Account status ([ADR 0015](../../adr/0015-account-status-state-machine.md))
   - **`ONBOARDING`** (Garage not yet resolved) → redirect to Onboarding wizard
   - **`ACTIVE`** (Garage resolved — first Vehicle added, or onboarding explicitly skipped) → redirect to Garage

**Errors:**

| Condition | Message shown |
|---|---|
| Wrong email, wrong password, or unverified account | *"Couldn't sign you in. Check your email and password — or your inbox if you haven't confirmed your account yet."* |
| Service error (5xx, network failure) | *"We stalled. Our mechanics are on it — try again in a moment."* |

---

### UC-AUTH-2 — Create an account

**Actor:** New User (no existing Account)  
**Precondition:** None  
**Milestones:** [V1](../../milestones/v1.md)

1. User switches to the Register tab
2. Fills in: Full name, Email, Password, Confirm password
3. Submits the form
4. System creates the account in an unverified state
5. System sends a verification email containing a signed link to `/verify-email?token=…`
6. User is shown a confirmation screen at `/verify-email` (no token yet) instructing them to check their inbox

**Errors:**

| Condition | Message shown |
|---|---|
| Email already registered, mismatched passwords, invalid password, or any user-input error | *"Couldn't create your account. Check your details and try again."* |
| Service error | *"We stalled. Our mechanics are on it — try again in a moment."* |

---

### UC-AUTH-3 — Verify email

**Actor:** Newly registered User following the verification link in their inbox  
**Precondition:** User exists in unverified state; token not expired  
**Milestones:** [V1](../../milestones/v1.md)

1. User clicks the verification link in their email
2. Browser navigates to `/verify-email?token=…`
3. System validates the token server-side
4. **Valid token:** account marked verified, user automatically signed in, routed via the post-login logic (UC-AUTH-1 step 5)
5. **Invalid or expired token:** error screen with a "Resend verification email" button

---

### UC-AUTH-4 — Request a password reset

**Actor:** User who has forgotten their password  
**Precondition:** None (the User may or may not exist — response must not reveal which)  
**Milestones:** [V1](../../milestones/v1.md)

1. User clicks "Forgot password?" on the Login tab
2. Browser navigates to `/forgot-password`
3. *(Out of scope for this spec — see [forgot-password spec](forgot-password.md) when created)*

---

### UC-AUTH-5 — Already-authenticated user visits `/login`

**Actor:** User with a valid active session  
**Precondition:** Valid access token or rotatable refresh token present  
**Milestones:** [V1](../../milestones/v1.md)

- Next.js middleware detects the session before the page renders
- Redirects immediately using the post-login logic (UC-AUTH-1 step 5)
- The login screen is never shown

---

### UC-AUTH-6 — Sign in with OAuth

**Actor:** User with an existing OAuth account  
**Precondition:** OAuth provider configured  
**Milestones:** [V2](../../milestones/v2.md)

*(Out of scope for V1 — see V2 section below)*

---

### UC-AUTH-7 — Silent session restoration on reload or direct navigation

**Actor:** User with a valid, unexpired refresh-token cookie but no in-memory session
**Precondition:** Browser holds a `refreshToken` cookie issued by a prior sign-in; `AuthProvider`'s in-memory `session` is `null` (e.g. the page was reloaded, or the User typed/bookmarked a protected URL directly)
**Milestones:** [V1](../../milestones/v1.md)

1. User reloads `/garage` or `/onboarding`, or navigates to one directly by URL
2. Next.js middleware sees the `refreshToken` cookie present and lets the request through (it cannot validate an opaque token at the edge — see [ADR 0016](../../adr/0016-client-session-and-route-protection.md))
3. `AuthProvider` mounts with `session: null` and immediately calls `POST /auth/refresh` ([refresh-api.md](./refresh-api.md)) — the `HttpOnly` cookie travels automatically via `apiFetch`'s `credentials: "include"`
4. On success, the System populates `session` from the response (`{ accessToken, user, account }`) and rotates the refresh-token cookie — the User never sees a sign-in prompt; the protected screen renders as if the session had never been lost
5. On failure (no cookie, expired, or invalid token), `session` stays `null` and the screen falls back to its existing no-session handling — e.g. the garage screen's redirect to `/login` ([garage-screen.md](../garage/garage-screen.md) — "No-session redirect")

> This is the mechanism [ADR 0016](../../adr/0016-client-session-and-route-protection.md) named as the fix for "no session restoration on reload, yet" and that [`v1.md`](../../milestones/v1.md) tracks as "Token rotation on refresh." See [refresh-api.md](./refresh-api.md) for the backend contract and [ADR 0017](../../adr/0017-refresh-token-rotation.md) for the full decision record.

---

## Acceptance Criteria

### Sign-in form

- [x] Login tab is active by default on page load
- [x] Email field uses `type="email"` and `autoComplete="email"`
- [x] Password field uses `type="password"` and `autoComplete="current-password"`
- [x] Submitting with empty fields shows inline validation before any network call
- [x] On success, user is redirected within 300ms of token receipt (no loading spinner needed for V1)
- [x] On user-input error, the error message appears inline below the form (not a toast)
- [x] On service error, the service error message appears inline below the form
- [ ] "Forgot password?" navigates to `/forgot-password` — link is rendered, but `/forgot-password` itself is not yet built (still a placeholder destination)

### Registration form

- [x] Full name field uses `type="text"` and `autoComplete="name"`; must be non-empty, max 100 characters
- [x] Email field uses `type="email"` and `autoComplete="email"`
- [x] Password field uses `autoComplete="new-password"`; validation is Unicode-aware:
  - Minimum 8 code points (not bytes)
  - At least one Unicode letter (`\p{L}`)
  - At least one Unicode digit (`\p{N}`)
  - Covers full-width and half-width characters (Japanese, Chinese, etc.)
- [x] Confirm password must match password; validated client-side before submit
- [x] On success, user is shown the `/verify-email` waiting screen
- [x] On any error, the catch-all user-error message is shown inline

### Session

- [x] On successful sign-in or post-verification auto-login, the system issues:
  - **Access token** — short-lived (15 min), signed with `jose`
  - **Refresh token** — browser session cookie (no `Max-Age`), rotated on every use
- [x] Access token payload contains `sub` (userId), `accountId`, and `role` — see [ADR 0002](../../adr/0002-custom-jwt-auth.md)
- [x] Refresh token is stored as an HTTP-only, Secure, SameSite=Strict cookie
- [x] Access token is stored in memory (not `localStorage`)
- [ ] Expired access token is silently refreshed using the refresh token before the user notices — `POST /auth/refresh` now exists and powers silent session *restoration* on reload/direct navigation ([UC-AUTH-7](#uc-auth-7--silent-session-restoration-on-reload-or-direct-navigation), [ADR 0017](../../adr/0017-refresh-token-rotation.md)); proactively or reactively renewing an access token that expires *mid-session* (e.g. retrying a 401'd API call after a transparent refresh) isn't wired up yet — remains a gap, worth tracking as a follow-up
- [x] On browser close, refresh token cookie expires automatically (no persistent session in V1)

### Route protection

- [x] Authenticated users visiting `/login` are redirected away — not via Next.js middleware (Edge middleware can confirm a session cookie is *present* but not which account status it belongs to, per [ADR 0016](../../adr/0016-client-session-and-route-protection.md)) but client-side: `AuthProvider`'s silent restore populates `session`, and the login screen routes onward via `routeForAccountStatus` (UC-AUTH-5, [ADR 0017](../../adr/0017-refresh-token-rotation.md)) — `auth.cy.ts`. The form can be visible for the brief duration of the silent-refresh request before the redirect fires; gating it behind a loading state would also delay the form for the far more common fresh-visitor case, so the small flash is left as-is
- [x] Unauthenticated users visiting any protected route are redirected to `/login`

### General

- [x] "Continue with Google" button is rendered but non-functional (placeholder for V2)
- [x] Terms of Service and Privacy Policy links are present but use `href="#"` (placeholder — **must be real URLs before any public launch**)
- [x] The brand panel renders the logo, headline, tagline, and 3 feature callouts
- [x] Switching tabs clears any active error message
- [x] Page title is "Revlog"

### E2E tests (Cypress)

- [x] Brand panel and both tab labels render — `auth.cy.ts`
- [x] Login fields shown by default; name field absent — `auth.cy.ts`
- [x] Switching to Register tab shows name + confirm password fields — `auth.cy.ts`
- [x] Switching back to Login tab hides name field — `auth.cy.ts`
- [ ] Inline user-error message shown on bad credentials
- [ ] Inline service-error message shown on 5xx response
- [x] Successful login redirects to Garage (Account status `ACTIVE`) — exercised by every `signIntoGarage`-driven spec in `garage.cy.ts`
- [x] Successful login redirects to Onboarding (Account status `ONBOARDING`) — `journey.cy.ts`
- [x] Authenticated user visiting `/login` is redirected — `auth.cy.ts` ("Login screen — already-authenticated visitor (UC-AUTH-5)")
- [x] Reloading or directly navigating to a protected screen with a valid refresh-token cookie silently restores the session — `garage.cy.ts` ("session restored on reload"); see [UC-AUTH-7](#uc-auth-7--silent-session-restoration-on-reload-or-direct-navigation) and [refresh-api.md](./refresh-api.md)

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Single route for login + register | Tab toggle at `/login` | Reduces navigation friction for new users; sign-in is the default |
| Error messaging strategy | One catch-all message for all user-input errors | Don't reveal which field is wrong (security); don't overwhelm with field-level errors |
| Service vs user error distinction | Two separate message tiers | Service errors need a different tone — not the user's fault |
| Email verification required | Yes, before first access | Prevents disposable-email abuse; confirms ownership |
| Session cookie lifetime | Browser session (no Max-Age) | Safe V1 default; persistent sessions deferred to V2 |
| Token storage | Refresh token in HTTP-only cookie; access token in memory | Mitigates XSS (no localStorage); CSRF mitigated by SameSite=Strict |
| Password validation | Unicode-aware (`\p{L}`, `\p{N}`) | ASCII-range checks break non-Latin scripts and full-width characters |
| "Remember me" checkbox | Removed for V1 | Persistent sessions require token rotation strategy; deferred to V2 |
| OAuth | Placeholder button only for V1 | See V2 section |
| Auth implementation | Custom JWT (`jose` + `bcrypt`), no auth framework | See [ADR 0002](../../adr/0002-custom-jwt-auth.md) |
| Dev email testing | Mailpit (Docker) | Avoid bypassing verification in dev — real code path catches real bugs |

---

## V2 Roadmap Items

### Persistent sessions ("Remember me")
Add a "Remember me" checkbox to the Login form. When checked, the refresh token cookie is issued with `Max-Age=2592000` (30 days) instead of session-scoped. Token rotation still applies on every refresh.

### OAuth sign-in (UC-AUTH-6)
Add social login on top of the existing JWT infrastructure. Do not use OAuth as the primary auth layer — the custom JWT layer stays underneath. When implementing, evaluate:

- **Auth.js (NextAuth v5)** — handles the OAuth dance; can be wired to emit custom JWTs. Least code, most magic.
- **Lucia** — lightweight, framework-agnostic, good for custom session models.
- **Better Auth** — newer, batteries-included, explicit about what it does.
- **Clerk** — fully managed (hosted UI + tokens). Fastest to ship; least control; introduces vendor lock-in.

Provider support will depend on the chosen library. Start from the library's supported list rather than picking providers first.

### Responsive layout
The brand panel currently has a `min-width: 360px` and does not collapse on small viewports. V2 should stack the panels vertically on mobile (brand panel collapses to a top bar or is hidden entirely).

---

## Legal prerequisites (before public launch)

The following are **not** V2 items — they are prerequisites for any public release, regardless of version.

**Terms of Service** must cover at minimum:
- Account creation and eligibility
- User-generated data ownership (service history belongs to the owner)
- Acceptable use
- Termination and data deletion rights

**Privacy Policy** must cover at minimum:
- What data is collected (email, name, vehicle data, log entries)
- How it is stored and for how long
- Whether it is shared with third parties
- GDPR / CCPA compliance if applicable

**Prompt for generating a draft (use with any LLM):**

```
You are a lawyer drafting legal documents for a software product.

Product name: Revlog
Product description: A web and mobile application for motorcycle owners to log maintenance events, track service history, and export records. Users create accounts with email and password. No payment processing. No third-party data sharing planned for V1.

Draft a [Terms of Service / Privacy Policy] appropriate for a small indie SaaS product. Use plain language. Cover the minimum legally necessary sections for a product serving users in the EU and US. Flag any section where I need to provide specific details (jurisdiction, company name, contact email, etc.).
```

---

## Out of scope

- `/forgot-password` flow (separate spec: [forgot-password.md](forgot-password.md))
- `/verify-email` confirmation screen (separate spec: [verify-email.md](verify-email.md))
- API endpoint contracts (covered in backend specs)
- Mobile app authentication (separate spec)
