# Mobile Welcome Spec

**Area:** Mobile / Welcome
**Status:** Not started
**Last updated:** 2026-06-30

---

## Overview

The Welcome screen is the first screen an unauthenticated user with no stored session sees on app launch. It introduces the Revlog brand and offers two entry points into the auth flow: creating an account and signing in. See [ADR 0030](../../adr/0030-mobile-welcome-screen.md).

Design files: [`revlog-mobile-welcome.html`](../../designs/mobile/revlog-mobile-welcome.html), same visual system as [`revlog-mobile-auth.html`](../../designs/mobile/revlog-mobile-auth.html) (dark surface, logo mark, wordmark treatment) so Welcome and the screen it leads into feel continuous. See [ADR 0032](../../adr/0032-mobile-logo-mark-and-display-font.md) for the logo mark and Outfit display font.

---

## Use Cases

### UC-MOB-WELCOME-1 — Unauthenticated user opens the app

**Actor:** New or signed-out user
**Precondition:** App cold start; no valid session in `expo-secure-store` (includes the case of having just logged out).
**Milestones:** [V1](../../milestones/v1.md)

1. `app/index.tsx` finds no valid session and redirects to `/welcome`.
2. Welcome screen renders the Revlog wordmark, a one-line value prop, and two buttons: `[Get Started]` and `[Log in]`.
3. Owner taps `[Get Started]` → app navigates to `/(auth)/register`.
4. Owner taps `[Log in]` → app navigates to `/(auth)/login`.

### UC-MOB-WELCOME-2 — Authenticated user opens the app

**Actor:** Returning, signed-in user
**Precondition:** App cold start; valid session in `expo-secure-store`.
**Milestones:** [V1](../../milestones/v1.md)

1. `app/index.tsx` finds a valid session and redirects straight to `/garage`. Welcome is never shown.

---

## Acceptance Criteria

- [ ] Unauthenticated cold start with no stored session lands on `/welcome`, not directly on `/(auth)/login`
- [ ] Authenticated cold start (valid session) never shows Welcome — goes straight to `/garage`
- [ ] `[Get Started]` navigates to `/(auth)/register`
- [ ] `[Log in]` navigates to `/(auth)/login`
- [ ] Welcome screen is a logic-free view; navigation handlers live in `useWelcomeViewModel`
- [ ] Welcome styling uses only `@maintenance-log/ui-tokens` values (no raw hex/pixel values)

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Position in flow | Between index redirect and auth stack | Gives unauthenticated users a branded entry point before the credentials form — [ADR 0030](../../adr/0030-mobile-welcome-screen.md) |
| CTAs | `Get Started` (register) + `Log in` | Matches the two entry use cases (UC-MOB-AUTH-1, UC-MOB-AUTH-2) without duplicating the combined login/register screen's own toggle |
| Visual style | Reuse auth screen's dark surface + wordmark tokens + logo mark | Visual continuity from native splash → Welcome → Auth; avoids inventing a new palette before a real design pass — see [ADR 0032](../../adr/0032-mobile-logo-mark-and-display-font.md) |

---

## Out of scope

- Feature-highlight carousel → V2
- Skip-Welcome-if-previously-seen heuristic → V2
