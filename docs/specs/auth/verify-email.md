# Email Verification Screen Spec

**Route:** `/verify-email`
**Status:** Spec'd, ready to build (backend implemented — see [register-api.md](./register-api.md))
**Last updated:** 2026-06-08

---

## Overview

The interstitial screen between account creation and the rest of the app. A new User lands here immediately after registering (no `?token=`, just "check your inbox" copy), and again — this time with `?token=…` in the URL — when they click the verification link in their email. The token-bearing visit is also where the User is auto-signed in and routed onward (UC-AUTH-3).

Introduces the centered single-card layout and atmospheric scene background (dot-grid + radial teal glow on `surface-base`) and the status-orb success animation that the onboarding wizard's Step 3 explicitly reuses (see [onboarding-wizard.md](../onboarding/onboarding-wizard.md) — "Decisions"). Both the layout and the orb are shared, not duplicated: the orb lives in `apps/web/src/components/StatusOrb.tsx`.

See [ADR 0005](../../adr/0005-design-system-and-visual-identity.md) for the visual identity this extends, and [ADR 0002](../../adr/0002-custom-jwt-auth.md) for the auth model.

---

## Layout

**Centered single card, full viewport** — same pattern as `/onboarding` (no split brand/form panel; this is a transitional screen with no marketing copy):

| Element | Content |
|---|---|
| Scene | `surface-base` background, dot-grid overlay, radial teal glow — atmospheric, not interactive |
| Card | `surface-raised`, `radius-xl`, max-width 440px, centered vertically and horizontally |
| Card content | Swaps per state: Waiting copy → Verifying spinner/orb → Verified success orb (brief, before redirect) → Error state with Resend action |

Responsive behaviour follows the same `@media (max-width: 860px)` card-collapse pattern as `/login` and `/onboarding`.

---

## States

The screen has exactly one route and four mutually-exclusive states, driven entirely by the presence and validity of the `?token=` query parameter:

### 1. Waiting (no `?token=` in the URL)

**Reached when:** UC-AUTH-2 step 6 — immediately after submitting the registration form.

Shown copy: a short "Check your inbox" message naming the email address the link was sent to, plus a note that the link expires in 24 hours. No network call is made in this state — there is nothing to verify yet.

### 2. Verifying (`?token=…` present, request in flight)

**Reached when:** the User clicks the link in their email (UC-AUTH-3 steps 1–2).

On mount, the screen calls `GET /auth/verify-email?token=…` (see [register-api.md](./register-api.md)). While the request is in flight, the orb plays its "in progress" state (ring draw-in, no checkmark yet) with a short "Verifying your email…" caption. This state is normally too brief to be noticed — it exists so the screen never looks broken while the request resolves.

### 3. Verified (200 response)

**Reached when:** the token is valid (UC-AUTH-3 step 4).

The orb completes its "verified" animation (ring draw-in + checkmark — the same component and animation onboarding's Step 3 plays). The screen stores the returned session (`accessToken`, `user`, `account`) and redirects via the shared account-status routing rule from UC-AUTH-1 step 5:
- `account.status === "ONBOARDING"` → `/onboarding`
- `account.status === "ACTIVE"` → `/garage`

The redirect happens automatically — there is no "Continue" button to click. The success state is shown just long enough for the orb's animation to read as a deliberate confirmation, not a flash.

### 4. Invalid or expired (400 response)

**Reached when:** the token is missing, already used, or past its 24-hour expiry (UC-AUTH-3 step 5).

Shown copy: an explanation that the link is no longer valid, plus a "Resend verification email" button. **The button renders but is non-functional in V1** — `POST /auth/register` and `GET /auth/verify-email` are the only auth endpoints in scope for this build; a resend endpoint is explicitly out of scope per [register-api.md](./register-api.md) ("Out of scope — Resend verification email endpoint"). This mirrors the precedent already set by `/login`'s "Continue with Google" button (rendered, intentionally inert, documented as a placeholder).

---

## Use Cases

This screen is the on-screen half of UC-AUTH-2 and UC-AUTH-3, both fully specified in [login.md](./login.md#uc-auth-2--create-an-account) and [login.md](./login.md#uc-auth-3--verify-email). It introduces no new use cases of its own — it is where those two use cases' on-screen steps live.

---

## Acceptance Criteria

### Waiting state

- [ ] Shown when the route is visited with no `?token=` query parameter
- [ ] Names the email address the verification link was sent to
- [ ] Mentions the 24-hour expiry
- [ ] Makes no network call

### Verifying state

- [ ] Shown immediately on mount when `?token=…` is present, before the request resolves
- [ ] Orb plays its "in progress" animation (no checkmark)
- [ ] Exactly one verification request is sent per page load (no duplicate calls from re-renders or React Strict Mode double-invocation)

### Verified state

- [ ] Orb plays the "verified" animation (ring draw-in + checkmark) — the shared `StatusOrb` component, `state="verified"`
- [ ] Session (`accessToken`, `user`, `account`) is stored via the `AuthProvider` before redirecting
- [ ] Redirects to `/onboarding` when `account.status === "ONBOARDING"`, to `/garage` when `account.status === "ACTIVE"` — using the shared `routeForAccountStatus` helper (see [ADR 0016](../../adr/0016-client-session-and-route-protection.md))
- [ ] No "Continue" button — the redirect is automatic

### Error state

- [ ] Shown on a 400 response (invalid, expired, or already-used token)
- [ ] Explains the link is no longer valid
- [ ] "Resend verification email" button is rendered (`btn-secondary` styling) but has no `onClick` handler — placeholder, matching the `/login` "Continue with Google" precedent
- [ ] Does not redirect anywhere automatically

### General

- [ ] Page title is "Revlog — Verify your email" (or equivalent), set via `src/app/verify-email/layout.tsx`, matching the `/onboarding` route's pattern
- [ ] Domain language matches [`CONTEXT.md`](../../../CONTEXT.md): "Vehicle," "Garage," "Owner"
- [ ] An error boundary wraps the page per the root observability rules, mirroring `onboarding/error.tsx`
- [ ] Reachable without authentication — this is, by definition, a pre-authentication screen; Next.js middleware must not gate it

### E2E tests (Cypress)

- [ ] Waiting state renders with the email address and 24-hour copy when visited with no token
- [ ] Visiting with a valid token shows the verifying state, then the verified state, then redirects to `/onboarding` for a fresh (zero-vehicle) account
- [ ] Visiting with an invalid/expired token shows the error state and the (inert) "Resend" button
- [ ] Page title matches the spec

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Layout pattern | Centered single card, reusing `/onboarding`'s scene/card pattern | Same "first five minutes" visual cohesion rationale the onboarding spec already states; building a third bespoke layout for an interstitial screen would fragment the design language for no benefit |
| Status orb | Extracted to a shared `StatusOrb` component (`apps/web/src/components/StatusOrb.tsx`) | The onboarding spec already documents this screen as the *origin* of the component onboarding "reuses" — building it here first and sharing it both ways is what makes that claim true, instead of each screen carrying its own copy |
| Auto-redirect vs. "Continue" button | Automatic, no button | UC-AUTH-3 step 4 says the user is "automatically signed in, routed via the post-login logic" — there is nothing for the user to decide at this step; a button would just add friction to a flow that has already resolved |
| Resend button | Rendered, non-functional | The resend endpoint is explicitly out of scope for the implemented backend ([register-api.md](./register-api.md) — "Out of scope"); shipping the screen without acknowledging the dead end would leave a User on an expired link with no visible next step. Matches the `/login` Google-button precedent for "designed for, not wired up yet" |
| Token read location | `useSearchParams` on mount, single effect with a ref guard | Prevents a duplicate verification call from React 19 Strict-Mode's intentional double-invocation of effects in development — a single-use token would otherwise be burned by the first of two calls, making the second look like an "already used" error |

---

## Out of scope

- Resend verification email (tracked in [register-api.md](./register-api.md) — "Out of scope")
- `/forgot-password` flow (separate spec: [forgot-password.md](./forgot-password.md) when created)
- Mobile app verification screen (separate spec)
