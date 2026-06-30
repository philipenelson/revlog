# Mobile app: Expo managed workflow, MVVM layers, iOS + Android

## Context

The V1 milestone includes a mobile app that delivers feature parity with the web app. The `apps/mobile/` directory exists with a minimal Expo scaffold (Expo 53, expo-router v4, React 19, React Native 0.79). No architectural decisions had been recorded for the mobile app.

Key constraints carried into this decision:

- The web app established an MVVM layered architecture (`app/` → `application/` → `model/` → `infrastructure/`) and the same pattern must apply to the mobile app. The mobile app uses `domain/` as the correct layer name — not `model/` — which is the correct DDD term. The web's `model/` directory will be renamed to `domain/` in a companion task.
- The app must work on both iOS and Android from day one.
- The app is fully offline-first with encrypted local storage (see ADR 0026 and ADR 0027).
- The product name is Revlog. The domain is `revlog.dev`. The bundle identifier is `dev.revlog`.

## Decision

### Runtime and workflow

Use **Expo 53 managed workflow**. The managed workflow supports expo-sqlite (including SQLCipher encryption via the `key` option since SDK 51), expo-secure-store, expo-router, and all other V1 dependencies without ejecting to a bare workflow. Native builds for Appium E2E are produced via `expo run:ios` / `expo run:android` or EAS Build.

### Routing

**expo-router v4** provides file-based routing identical in concept to Next.js's App Router. Route files under `apps/mobile/app/` are shells only — no logic, no state, no JSX beyond delegating to an `application/` screen. This mirrors the web rule that `app/page.tsx` files are thin entry points.

### Layered architecture

```
app/                          ← expo-router routing shell (entry points only)
application/                  ← screens, viewmodels, components, providers, navigation
  screens/<screen>/
    <Screen>.tsx              ← View: renders viewmodel output; no logic
    use<Screen>ViewModel.ts   ← ViewModel: all state, effects, handlers
  components/                 ← reusable presentational components
  providers/                  ← AuthProvider, SyncProvider
  navigation/                 ← route helpers (routeForAuthState, etc.)
domain/                       ← types, repositories, validation
  repositories/               ← domain-facing abstractions over LocalDatabase
  types.ts
  validation/
infrastructure/               ← LocalDatabase adapter, TokenHttpClient, SyncService
  database/
  http/
  sync/
  storage/
```

Dependency direction is one-way: `application` imports from `domain` and never from `infrastructure` directly; `domain` imports from `infrastructure` via ports; `infrastructure` imports nothing above it.

### Testing

**Humble object pattern**: Screen components are logic-free and are not unit-tested. Jest covers viewmodels, repositories, and services. Appium covers the full user journey through the real app (see ADR 0029).

### Platforms and identifiers

- **iOS and Android** from day one. Expo's cross-platform abstraction means no platform-specific code is expected at V1 scale.
- **Bundle ID / package name:** `dev.revlog` (reverse of the `revlog.dev` domain, following the reverse-domain convention).
- **App display name:** Revlog.

## Status

accepted

## Consequences

- All new mobile screens follow the same shape as web screens: spec → repository → viewmodel → view.
- The expo-router `app/` directory stays thin; all screen logic lives in `application/`.
- The `domain/` folder name is canonical for both mobile (from day one) and web (after rename). No new code uses `model/`.
- Expo managed workflow means no custom native modules that require ejecting; any dependency requiring a custom native module must be evaluated carefully before adoption.

## V2+ items

- **EAS Build pipeline** — automate iOS and Android builds in CI via Expo Application Services.
- **Deep linking** — iOS Universal Links + Android App Links for in-app handling of token-gated URLs (transfers, reports).
- **Push notifications** — APNs (iOS) + FCM (Android) via `expo-notifications` for scheduled maintenance reminders.
