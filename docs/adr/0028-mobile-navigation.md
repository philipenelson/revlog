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

### Update (2026-07-03): every Garage-stack screen renders its own header; the shared native header (gear icon, offline indicator) never shipped

Gap found while building Edit Vehicle: this ADR's original decision assumed a single shared native Stack header carrying the gear icon and offline indicator across every Garage-stack screen. In practice, once Garage and Vehicle Detail were actually built, both rendered their own custom header (matching their design files exactly — back link, title, action icons, and, for Garage, its own `OfflineIndicator`) instead of using the native one. `garage/_layout.tsx` was left straddling both worlds: `screenOptions` kept the native header *visible but transparent* as the stack-wide default, with `Stack.Screen` entries for `index` and `[vehicleId]/index` individually overriding it to `headerShown: false`. Every other route (Edit Vehicle among them) inherited the visible-but-transparent default.

This mismatch was invisible in code review and in unit tests — it only surfaced building Edit Vehicle's screen, where the still-visible native header sat on top of the custom one and silently absorbed every tap on the Save/Cancel buttons. A live Appium run misdiagnosed this at length as a keyboard-occlusion or Appium-tooling issue before the actual cause was found by inspection: the stray native header, not a test-tooling gap.

**Decision:** `garage/_layout.tsx`'s `screenOptions` now sets `headerShown: false` for the whole stack — every screen owns its own header, full stop. There is no shared native header today; the gear icon → Settings and offline-indicator-in-the-header pieces of this ADR's original decision were never implemented and aren't planned to be revisited under this design. A future screen that wants Settings access or an offline indicator implements it itself, the way Garage already does for the offline indicator.

This does not change the root-stack-with-Settings-as-a-push navigation decision itself, only which layer owns header rendering.
