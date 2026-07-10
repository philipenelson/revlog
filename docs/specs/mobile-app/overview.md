# Mobile App — V1 Overview

**Area:** Mobile
**Status:** Not started
**Last updated:** 2026-06-30

---

## Overview

The Revlog mobile app delivers full feature parity with the V1 web app on iOS and Android. It is a native React Native app built with Expo 53 and expo-router v4, fully offline-first with encrypted local storage.

**Domain:** `revlog.dev`
**Bundle ID / Package name:** `dev.revlog` (iOS and Android)
**Platforms:** iOS 16+ and Android 10+

---

## Architecture

The mobile app follows Hexagonal (Ports & Adapters) MVVM, the same as the web app, adapted for React Native (see ADR 0041):

```
app/             ← expo-router routing shell (entry points only, no logic)
application/     ← screens, viewmodels, components, providers, navigation
domain/          ← ports (Store/OutboxWriter/PhotoStore), repositories, validation
adapters/        ← SQLiteStore, TokenHttpClient, SyncService, storage
```

Dependency direction: `app → application → domain`, with `adapters/` implementing the ports the core defines (inward).

**Shared services:** All API service functions live in `packages/api-client` and are shared between the web and mobile apps. Each app provides its own `HttpClient` adapter. See ADR 0024.

**Offline-first:** All reads come from the local SQLite database (expo-sqlite + Drizzle ORM, SQLCipher encrypted). Writes are applied locally and queued in the outbox for sync. See ADR 0026 and ADR 0027.

---

## Features in scope for V1

### Welcome
- Branded pre-auth entry screen with "Get Started" / "Log in" CTAs

### Auth
- Login
- Register
- Email verification
- Forgot password (email input on mobile → reset completed in browser)
- Silent token refresh on app foreground
- Logout

### Onboarding
- Add first vehicle wizard (same flow as web)

### Garage
- List of Owner's Vehicles
- Empty state

### Vehicle
- Vehicle detail screen
- Add vehicle
- Edit vehicle
- Delete vehicle (with confirmation)
- Vehicle photo display (read-only; upload is V2)

### Log Entry
- Create log entry
- Edit log entry

### Vehicle Transfer
- Initiate transfer from Vehicle Detail (mobile)
- Acceptance by recipient is browser-only in V1 (deep linking is V2)
- Locked/pending state visible in Garage

### Mechanic Printout
- Generate share link
- Share via native OS share sheet (`Share.share()`)
- Revoke share link

### Settings
- View account info (read-only)
- Open Terms, Privacy, and Cookie Policy in browser (`Linking.openURL()`)
- Logout

### Offline / Sync
- All data stored locally in encrypted SQLite
- Outbox pattern for write sync
- Offline status indicator in navigation header

---

## Out of scope for V1

| Feature | Target |
|---|---|
| Media / photo attach on log entries | V2 |
| Vehicle photo upload | V2 |
| Push notifications | V2 |
| Deep linking (Universal Links / App Links) | V2 |
| Transfer acceptance on mobile | V2 (requires deep linking) |
| Fuel entries | V2 |
| Scheduled maintenance items | V2 |
| OAuth sign-in | V2 |

---

## ADRs

| ADR | Decision |
|---|---|
| [0023](../../adr/0023-mobile-app-architecture.md) | Expo managed workflow, MVVM layers, iOS + Android |
| [0024](../../adr/0024-shared-api-client-package.md) | Shared `packages/api-client` with `HttpClient` port |
| [0025](../../adr/0025-mobile-auth-token-storage.md) | expo-secure-store + `Refresh-Token` header |
| [0026](../../adr/0026-mobile-local-database.md) | expo-sqlite + Drizzle + SQLCipher |
| [0027](../../adr/0027-mobile-sync-outbox-pattern.md) | Outbox pattern + SyncService |
| [0028](../../adr/0028-mobile-navigation.md) | Garage root stack, Settings as stack push, no tab bar |
| [0029](../../adr/0029-mobile-e2e-testing.md) | Jest unit tests + Appium E2E |
| [0030](../../adr/0030-mobile-welcome-screen.md) | Pre-auth Welcome screen ahead of login |
