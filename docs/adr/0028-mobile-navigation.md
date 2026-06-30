# Mobile navigation: Garage root stack, Settings as stack push, no tab bar

## Context

The mobile app has two top-level sections: the Garage (the Owner's primary workspace) and Settings (account info, legal links, logout). A bottom tab bar is the most common pattern for top-level navigation in mobile apps, but it trades permanent screen space for navigation between sections that the Owner only switches between rarely.

Three navigation patterns were considered:

**Bottom tab bar** — persistent chrome at the bottom of the screen with Garage and Settings tabs. Standard, recognisable, but consumes vertical screen space on every screen even when the Owner is exclusively in the Garage (which is almost always the case).

**Side drawer** — hamburger or swipe gesture opens a panel with navigation options. Common in Android-first apps. Feels heavy for two sections and hides navigation behind a gesture.

**No persistent chrome — Settings as stack push** — the app opens directly to the Garage. Settings is accessed via a gear icon in the navigation header, pushed onto the stack as a full-screen screen with a standard back transition. No permanent navigation chrome. The Owner never sees navigation UI unless they actively go to Settings.

## Decision

Use **Garage as the root stack with Settings as a header-triggered stack push**. No tab bar.

The expo-router file structure maps to this directly:

```
app/
  _layout.tsx              ← Root stack (auth gate, AuthProvider)
  index.tsx                ← Redirects to /garage or /login based on auth state
  (auth)/
    login.tsx
    register.tsx
    verify-email.tsx
    forgot-password.tsx
  garage/
    _layout.tsx            ← Garage stack with header (gear icon → settings)
    index.tsx              ← Garage list screen
    [vehicleId]/
      index.tsx            ← Vehicle detail
      edit.tsx             ← Edit vehicle
      transfer.tsx         ← Initiate vehicle transfer
      report.tsx           ← Mechanic printout share
      log/
        new.tsx            ← New log entry
        [entryId].tsx      ← Edit log entry
    add.tsx                ← Add vehicle
  settings.tsx             ← Settings screen (pushed from header)
  onboarding.tsx           ← Onboarding wizard
```

Route files are shells only — they delegate to `application/screens/` components with no logic of their own. This is the same rule as the web's `app/page.tsx` files.

The gear icon in the Garage stack header calls `router.push('/settings')`. Settings slides in from the right with a standard stack transition. The back button returns to wherever in the Garage stack the Owner was.

### Offline indicator placement

The offline indicator (a small icon) lives in the right side of the Garage stack header, to the left of the gear icon. It is visible on all Garage-stack screens and disappears when the device is online and the outbox is empty.

## Status

accepted

## Consequences

- No permanent navigation chrome frees the full screen for content on every Garage screen.
- Settings is accessed via the standard stack transition — familiar on both iOS (right-to-left slide) and Android (material elevation animation).
- The file structure is flat enough that adding a third top-level section in V2 would mean either adding it to the header or introducing a tab bar at that point; neither requires significant restructuring.
- expo-router handles the auth gate at the root `_layout.tsx` level; all unauthenticated routes live in `(auth)/` and are unreachable once authenticated.

## V2+ items

- **Tab bar** — if a third prominent top-level section emerges (e.g. a Fuel Entries dashboard or a reminders inbox), introduce a bottom tab bar at that point. The stack-push approach does not preclude this.
