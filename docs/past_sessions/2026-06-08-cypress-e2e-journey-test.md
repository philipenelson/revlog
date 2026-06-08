# Session: Wire up real auth → verification → onboarding, then drive journey.cy.ts through it

**Date:** 2026-06-08
**Branch/worktree:** `worktree-cypress-e2e-flows`

---

## Goal

Originally: write a Cypress E2E test walking through the app's built-so-far flows as one connected journey — auth screen → onboarding → garage — fixing any issues found along the way.

The first draft of `journey.cy.ts` used `cy.visit("/onboarding")` to teleport from the auth screen straight into the wizard. **The user rejected this approach**: it papers over the fact that the screens aren't actually wired together. Per their description, the real flow is register → verification email → click the link → land in onboarding; and login with an account that hasn't finished onboarding should also land in onboarding — with `/onboarding` unreachable by an unauthenticated or unverified user. None of that was built: no submit handlers on the auth forms, no `/verify-email` screen, no `POST /auth/login`, no route-protection middleware.

So the goal became: **build that real wiring**, then rewrite the journey test to drive it through actual clicks — register, read the verification email out of Mailpit, click through, sign back in, and assert the middleware gate — rather than testing UI screens that float disconnected from each other.

## Key decisions

- **Scope cut, stated up front and held to:** wire exactly the path the user described (register → verify-email → onboarding; login with `ONBOARDING` status → onboarding; middleware gating `/onboarding` and `/garage`). Explicitly *not* wired in this session — each already separately tracked: the onboarding wizard's vehicle-creation submission (`POST /vehicles`), the garage list's `GET /vehicles` integration, `POST /auth/refresh` / token rotation, and UC-AUTH-5 ("authenticated user visiting `/login` is redirected away" — which needs token rotation, since Edge middleware can't cheaply learn account status without it).
- **`@hookform/resolvers` upgraded from v3 to v5.** The v3 resolver threw raw `ZodError`s instead of populating `formState.errors` — it doesn't understand Zod v4's restructured error format. v5 implements the Standard Schema spec, which Zod v4 supports natively. Bumped `react-hook-form` to `^7.78.0` as its peer.
- **`StatusOrb` extracted as a shared component.** The onboarding wizard's inline `SuccessOrb` became `apps/web/src/components/StatusOrb.tsx` with a `state: "verifying" | "verified"` prop, used by both `/onboarding` (verified) and `/verify-email` (both states) — exactly what the onboarding spec already claimed happened, just not yet built.
- **Middleware checks cookie *presence* only, not validity.** `apps/web/src/middleware.ts` redirects to `/login` when the `refreshToken` cookie is absent on `/onboarding/:path*` and `/garage/:path*`. It cannot validate the opaque token or read account status from the Edge runtime without a network round-trip — that's the deferred `/auth/refresh` work, documented in [ADR 0016](../adr/0016-client-session-and-route-protection.md).
- **The journey test reads real email out of Mailpit, not a shortcut.** Cypress can't drive a mail client to "click" a link, so the realistic equivalent is: query Mailpit's REST API for the message, regex the `?token=` out of its body, and `cy.visit()` the URL that clicking the link would actually produce — a genuine navigation, not a teleport.
- **The journey's three scenarios share one account, in order.** Test 1 registers and verifies a fresh account (capturing its email in a `describe`-scoped `let`); test 2 reuses that *same still-`ONBOARDING`* account to exercise the login → onboarding path the user explicitly described — a deliberate "journey" dependency, not three independent specs. The middleware-gate scenario needs no account at all.
- **Removed the "Remember me" checkbox while wiring login.** `docs/specs/auth/login.md`'s Decisions table already says it was "Removed for V1 — persistent sessions require token rotation; deferred to V2," but the form still rendered it. Brought the implementation in line with the spec, per the project rule that documentation comes before code.

## Issues found and fixed

1. **`@hookform/resolvers@3.10.0` + `zod@4.4.3` incompatible** — see decision above. Fixed by upgrading to `@hookform/resolvers@^5.4.0` / `react-hook-form@^7.78.0`.
2. **`loginSchema.email` wasn't sanitized** — unlike `registerSchema`, it lacked `.trim().toLowerCase()`, so a login lookup wouldn't match an account stored with normalized casing from registration. Added the same transform — a real input-handling bug the project's sanitization rules require fixing on sight.
3. **Login form still rendered "Remember me"** despite the spec saying it was removed for V1 — deleted it (see decision above).
4. **Middleware broke the existing screen-level specs** — `onboarding.cy.ts` and `garage.cy.ts` `cy.visit()` directly into protected routes with no session, so the new middleware redirected them to `/login` (14 failures). Fixed by adding `cy.setCookie("refreshToken", "e2e-<screen>-session")` to each spec's `beforeEach` — satisfies the middleware's presence-only check without a real backend session, since those specs intentionally test screen UI in isolation (the real auth seam is `journey.cy.ts`'s job). Both specs are back to 100% passing.
5. **`/verify-email`'s waiting and error states had no dedicated E2E coverage.** `journey.cy.ts` only brushes past the waiting state on its way through the happy path — the 24-hour-expiry copy and the invalid/expired-token error state (with its inert "Resend" button) were untested, which the project's "every screen, every error state" testing rule requires. Added `verify-email.cy.ts` to close that gap.

## What was built

Specs and ADR (commit `2f32c4d`):
- `docs/specs/auth/verify-email.md`, `docs/specs/auth/login-api.md`
- `docs/adr/0016-client-session-and-route-protection.md` — documents the `AuthProvider` in-memory session, the `apiFetch` wrapper, and the presence-only middleware design (and why it can't yet do UC-AUTH-5)

API (commit `11780ef`):
- `POST /auth/login` — mirrors `verifyEmail`'s token-issuance exactly; collapses "no such user," "wrong password," and "unverified email" into one indistinguishable 401 (no account-state enumeration); Vitest coverage for the happy path and all three guard clauses

Web plumbing (commit `2f56b47`):
- `apps/web/src/lib/api.ts` (`apiFetch`/`ApiError`), `apps/web/src/lib/auth/AuthProvider.tsx` (in-memory session context), `apps/web/src/lib/auth/routeForAccountStatus.ts`

Forms and screens (commits `d222c5b`, `46c879e`, `7004672`):
- Register form wired to `POST /auth/register` → redirects to `/verify-email?email=...`
- `apps/web/src/app/verify-email/` — full 4-state screen (waiting / verifying / verified / error), `Suspense`-wrapped `useSearchParams`, a `useRef` guard against duplicate verification calls under Strict Mode double-invocation
- `apps/web/src/components/StatusOrb.tsx` (+ module CSS) — shared orb extracted from onboarding, now used by both screens
- Login form wired to `POST /auth/login` → `setSession` + `routeForAccountStatus` redirect; "Remember me" removed

Middleware (commit `17e2367`):
- `apps/web/src/middleware.ts` — gates `/onboarding/:path*` and `/garage/:path*` on `refreshToken` cookie presence

Tests and docs (commits `524ca34`, `9150136`, `663c1e9`, this one):
- `apps/web/cypress/e2e/journey.cy.ts` — fully rewritten around real navigation (see Verification below)
- `apps/web/cypress/e2e/verify-email.cy.ts` — new, covers the waiting and error states in isolation
- Checked off the now-true acceptance criteria in `docs/specs/auth/{login,login-api,verify-email}.md` and `docs/milestones/v1.md`, and called out what's still deferred (`/forgot-password`, token rotation, UC-AUTH-5)

## Verification performed

- `journey.cy.ts` now drives three real scenarios:
  1. Fill and submit the register form → land on `/verify-email` → fetch the just-sent message from Mailpit's REST API, regex the `?token=` out of its body, `cy.visit()` that URL (the real equivalent of clicking the email link) → assert the redirect lands on `/onboarding`
  2. `cy.clearCookies()`, sign back in through the login form with that same still-`ONBOARDING` account → assert redirect to `/onboarding`
  3. With no session cookie, visiting `/onboarding` or `/garage` redirects to `/login`
- Full suite (`auth` + `garage` + `journey` + `onboarding` + `verify-email`) → **24/24 passing**, run twice for stability, zero regressions
- `npx tsc --noEmit` and `npx eslint` clean on every touched file
- Manually exercised the whole flow against the live dev servers and Mailpit's UI at `localhost:8025` before committing each step — registered a real account, read the verification email, clicked through, confirmed the onboarding redirect, confirmed the middleware gate via `curl`

## Explicitly out of scope

- Wiring the onboarding wizard's vehicle-creation submission (`POST /vehicles`) and the garage list's `GET /vehicles` integration — both separately specced and tracked; the wizard and garage stay stubbed exactly as `onboarding.cy.ts`/`garage.cy.ts` already test them
- `POST /auth/refresh`, token rotation, and session restoration on page reload — not needed for this flow, since every protected-route entry happens via client-side navigation immediately after a fetch that already set the session; tracked as a follow-up that also unblocks UC-AUTH-5
- UC-AUTH-5 ("authenticated user visiting `/login` is redirected away") — depends on the token-rotation work above; Edge middleware can confirm a session cookie exists but not what account it belongs to
- `/forgot-password` — pre-existing placeholder link, unrelated to this session's auth-wiring scope
