# Mobile Navigation Spec

**Area:** Mobile / Navigation
**Status:** Not started
**Last updated:** 2026-06-30

---

## Overview

The mobile app uses expo-router v4 for file-based routing. The navigation structure mirrors the web app's route hierarchy but is rendered as native iOS and Android navigation stacks rather than browser page transitions. Route files are shells only — all logic and markup live in `application/screens/`. See ADR 0028 and ADR 0030 (Welcome screen).

Design files: [`revlog-mobile-navigation.html`](../../designs/mobile/revlog-mobile-navigation.html) (app shell, header, Settings push) · [`revlog-mobile-onboarding.html`](../../designs/mobile/revlog-mobile-onboarding.html)

---

## Route map

```
app/
  _layout.tsx              ← Root stack. Wraps with AuthProvider and SyncProvider.
                             Auth gate: unauthenticated → redirect to /welcome.
  index.tsx                ← Redirects to /garage (authenticated) or /welcome (no session).
  welcome.tsx               ← Branded entry screen. "Get Started" → register,
                             "Log in" → login. See ADR 0030.
  (auth)/
    _layout.tsx            ← Auth stack (no header chrome).
    login.tsx              ← Login and register screen.
    register.tsx           ← Register screen (linked from login).
    verify-email.tsx       ← "Check your email" confirmation screen.
    forgot-password.tsx    ← Forgot password email input screen.
  onboarding.tsx           ← Onboarding wizard (ONBOARDING account status only).
  garage/
    _layout.tsx            ← Garage stack. Header: "Revlog" wordmark (left),
                             offline indicator + gear icon (right).
    index.tsx              ← Garage list screen.
    add.tsx                ← Add vehicle screen.
    [vehicleId]/
      index.tsx            ← Vehicle detail screen.
      edit.tsx             ← Edit vehicle screen.
      transfer.tsx         ← Initiate vehicle transfer screen.
      report.tsx           ← Mechanic printout share screen.
      log/
        new.tsx            ← New log entry screen.
        [entryId].tsx      ← Edit log entry screen.
  settings.tsx             ← Settings screen (pushed from gear icon in Garage header).
```

---

## Auth gate

`app/_layout.tsx` reads auth state from `AuthProvider`. If no valid session is present, all navigation attempts redirect to `/welcome` (see [ADR 0030](../../adr/0030-mobile-welcome-screen.md)). If a valid session exists and account status is `ONBOARDING`, navigation redirects to `/onboarding`. The `routeForAuthState` helper in `application/navigation/` encapsulates this logic, mirroring `routeForAccountStatus` on the web, and resolves to one of `/garage`, `/welcome`, or `/onboarding`.

---

## Garage stack header

The Garage stack (`app/garage/_layout.tsx`) renders a consistent header across all Garage screens:

| Position | Content |
|---|---|
| Left | Back button (on drill-down screens) or "Revlog" wordmark (on root Garage screen) |
| Center | Screen title (e.g., "CBR 600RR", "New Log Entry") |
| Right | Offline indicator icon (cloud-off or sync-pending, hidden when online + synced) · Gear icon (navigates to `/settings`) |

The gear icon is present on all Garage stack screens, including drill-down screens. Tapping it pushes `/settings` onto the stack with a standard right-to-left slide transition. The back button on the Settings screen returns to wherever in the Garage stack the Owner was.

---

## Offline indicator

The offline indicator is a small icon in the Garage header (right side, left of gear icon). It has three visible states:

| State | Icon | Condition |
|---|---|---|
| Hidden | — | Device online AND outbox empty |
| Offline | Cloud-off icon | `networkState.isConnected === false` |
| Pending sync | Cloud-upload icon (or spinner) | Device online AND `outbox.pendingCount > 0` |

The indicator is provided by `application/components/OfflineIndicator.tsx` and reads from `SyncProvider` context.

---

## Screen transitions

expo-router uses the platform's default stack transition:
- iOS: right-to-left slide (push), left-to-right slide (pop)
- Android: bottom-up slide (push), top-down slide (pop)

No custom transitions are used in V1.

---

## Acceptance Criteria

- [ ] Unauthenticated user navigating to any Garage route is redirected to welcome
- [ ] `[Log in]` and `[Get Started]` on Welcome route to `/(auth)/login` and `/(auth)/register` respectively
- [ ] Authenticated user with ONBOARDING status is redirected to onboarding
- [ ] Authenticated user with ACTIVE status lands on Garage list
- [ ] Gear icon on Garage header pushes Settings screen
- [ ] Back button on Settings screen returns to previous Garage screen
- [ ] Offline indicator appears in header when device has no connectivity
- [ ] Offline indicator appears when device is online but outbox has pending entries
- [ ] Offline indicator is hidden when device is online and outbox is empty
- [ ] All route files delegate to `application/screens/` — no logic in `app/` files

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| No tab bar | Stack-only navigation | Only 2 top-level sections; Garage is almost always active; tab bar wastes screen space |
| Settings as stack push | `router.push('/settings')` from header gear icon | Native stack transition, no special chrome, standard iOS/Android pattern |
| Offline indicator in header | Right side of Garage header | Always visible during use; non-intrusive (icon only, no banner) |

---

## Out of scope

- Deep linking / Universal Links → V2
- Custom navigation transitions → V2
- Bottom tab bar → V2 if a third top-level section is added
