# Mobile: pre-auth Welcome screen ahead of login

## Context

ADR 0028 defined `app/index.tsx` as a pure auth-gate redirect with no UI — an unauthenticated user lands directly on `(auth)/login.tsx`, which doubles as the login and register screen.

Starting implementation surfaced a gap: dropping a brand-new user straight into a credentials form gives Revlog no "front door." A first-time (or just-logged-out) user should see the brand — wordmark, one-line value prop — and make an explicit choice between creating an account and signing in, before reaching the auth form itself. This is a common mobile convention and costs one extra tap only for the unauthenticated, no-session case.

## Decision

Insert a `welcome.tsx` route between the index redirect and the auth stack. `app/index.tsx` redirects to `/welcome` (no stored session) instead of `/(auth)/login` directly. From Welcome, `[Get Started]` pushes `/(auth)/register` and `[Log in]` pushes `/(auth)/login`.

Updated unauthenticated portion of the route map (full map lives in ADR 0028 / `docs/specs/mobile-app/navigation.md`):

```
app/
  index.tsx                 ← Redirects to /garage (session) or /welcome (no session)
  welcome.tsx                ← NEW. Branded entry screen, "Get Started" / "Log in" CTAs
  (auth)/
    login.tsx
    register.tsx
    verify-email.tsx
    forgot-password.tsx
```

This does not change anything else decided in ADR 0028 — Garage as the root stack, Settings as a header-triggered stack push, no tab bar. Welcome only affects the pre-auth entry point.

Welcome is a standard MVVM screen (`application/screens/welcome/WelcomeScreen.tsx` + `useWelcomeViewModel.ts`), not a special case — the route file delegates with no logic, and the two button taps are navigation callbacks owned by the viewmodel, same as every other screen.

## Status

accepted

## Consequences

- One extra tap between cold start and the login form for unauthenticated/no-session users — acceptable since an authenticated cold start (the common case once installed) goes straight to `/garage` and never sees Welcome.
- Welcome needs its own spec (`docs/specs/mobile-app/welcome.md`) per the "one spec per feature" rule, rather than being folded into `auth.md` or `navigation.md`.
- `routeForAuthState` (the auth-gate helper referenced in `navigation.md`) must resolve to three destinations instead of two: `/garage`, `/welcome`, `/onboarding`.

## V2+ items

- Feature-highlight carousel on Welcome → V2, not needed for V1 launch.
- Skip-Welcome-if-previously-installed heuristic → V2, no local flag/analytics for this in V1.
