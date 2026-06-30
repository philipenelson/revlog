# Session: Mobile App Planning

**Date:** 2026-06-30
**Branch:** planning session (no code changes)

---

## Goal

Plan the V1 mobile app for Revlog — a fully offline-first, encrypted React Native app delivering feature parity with the V1 web app on iOS and Android. All architectural decisions were reached through a structured grilling session covering scope, auth, navigation, architecture, database, sync, testing, and platform identity.

---

## Key Decisions

| Decision | Choice | Reason |
|---|---|---|
| Scope | Full V1 web parity | All web V1 features on mobile; no partial MVP |
| Auth storage | expo-secure-store + Refresh-Token header | httpOnly cookies not available in React Native; OS Keychain/Keystore is the correct equivalent |
| `POST /auth/refresh` change | Accept `Refresh-Token` header when no cookie present | Minimum API surface change; web path unchanged |
| Navigation | Garage as root stack; Settings as stack push from header gear icon | Only 2 top-level sections; no tab bar needed; screen space preserved for content |
| Architecture | `app/` / `application/` / `domain/` / `infrastructure/` (MVVM, same as web) | Consistency across apps; `domain/` is the correct DDD name (`model/` on web is a tracked rename) |
| Shared services | `packages/api-client` with `HttpClient` port | Single source of truth for API surface; web migrates first before mobile services are written |
| `model/` → `domain/` rename | Web app rename is first commit of mobile milestone | Fixes incorrect naming; alphabetical order matches dependency flow |
| Local database | expo-sqlite + Drizzle ORM + SQLCipher encryption | 484K weekly downloads; Expo-maintained; no native config; encryption via key option; Drizzle is lightweight and replaceable |
| LocalDatabase port + repositories | `infrastructure/database/LocalDatabase.ts` port; `domain/repositories/` above it | Keeps domain and application layers free of SQLite knowledge; easy to swap adapter |
| Sync strategy | Outbox pattern + SyncService | Atomic writes; no soft deletes needed; idempotency keys; handles offline deletes cleanly |
| Offline indicator | Visible, minimal — header icon when offline or outbox has pending entries | Owner should know their change is queued; discovery-after-the-fact is worse UX |
| Media | Out of scope V1 → V2 | OPFS not available on mobile; keeps V1 scope tight |
| Vehicle transfer acceptance | Browser-only in V1 | Web already handles it; deep linking is V2 |
| Mechanic printout sharing | Native `Share.share()` — no email form | OS share sheet covers all channels; email form exists on web only because browsers can't trigger share sheet |
| Legal pages | `Linking.openURL()` in Settings | Content maintained on web; no native legal screens needed |
| Forgot password | In mobile V1 scope; reset form in browser | Web implements shortly after; deep linking for reset is V2 |
| Testing | Jest (viewmodels, services, repositories) + Appium E2E; humble object pattern | Appium is most recognised mobile E2E in job market; humble object means no unit tests on views |
| Web Cypress → Playwright | V2 | Playwright has surpassed Cypress in job market demand (3× job postings 2024–2026) |
| Platforms | iOS + Android | Both from day one; Expo abstracts the difference |
| Styling | `@maintenance-log/ui-tokens` TS values only in StyleSheet.create(); pre-commit hook extended | Consistent with web guardrail; no raw hex codes or hardcoded pixel values |
| Push notifications | V2 | No V1 use case justifies APNs + FCM setup |
| Deep linking | V2 — general capability for the app | Not just transfers; covers verification, reset, report links |
| Bundle ID | `dev.revlog` (iOS and Android) | Reverse-domain of `revlog.dev`; standard convention |
| Domain | `revlog.dev` | `revlog.com` and `revlog.app` are taken; `.dev` is Google-maintained, HTTPS-required, professional |

---

## What Was Built

Documentation only — this session produced planning docs, ADRs, and specs. No code was written.

---

## Docs Created

### ADRs

- `docs/adr/0023-mobile-app-architecture.md` — Expo managed workflow, MVVM layers, iOS + Android, bundle ID
- `docs/adr/0024-shared-api-client-package.md` — `packages/api-client` with `HttpClient` port
- `docs/adr/0025-mobile-auth-token-storage.md` — expo-secure-store + Refresh-Token header fallback
- `docs/adr/0026-mobile-local-database.md` — expo-sqlite + Drizzle + SQLCipher + port/repositories
- `docs/adr/0027-mobile-sync-outbox-pattern.md` — outbox pattern + SyncService
- `docs/adr/0028-mobile-navigation.md` — Garage root stack, Settings as stack push, no tab bar
- `docs/adr/0029-mobile-e2e-testing.md` — Jest + Appium; humble object pattern; Playwright V2

### Specs

- `docs/specs/mobile-app/overview.md` — scope, feature list, architecture summary, ADR index
- `docs/specs/mobile-app/auth.md` — login, register, verify email, forgot password, token refresh, logout
- `docs/specs/mobile-app/navigation.md` — full navigation structure, route map, expo-router file tree
- `docs/specs/mobile-app/garage.md` — garage list screen, offline reads, sync on foreground
- `docs/specs/mobile-app/vehicle.md` — vehicle detail, add, edit, delete, transfer-pending state
- `docs/specs/mobile-app/log-entry.md` — log entry create, edit, delete; offline behaviour
- `docs/specs/mobile-app/vehicle-transfer.md` — initiate on mobile; browser-only acceptance in V1
- `docs/specs/mobile-app/mechanic-printout.md` — generate link, share via OS share sheet, revoke
- `docs/specs/mobile-app/settings.md` — settings screen, account info, legal links, logout
- `docs/specs/mobile-app/offline-sync.md` — LocalDatabase port, outbox schema, SyncService, indicator states

### Designs

- `docs/designs/revlog-mobile-navigation.html` — app shell: Garage root, Vehicle Detail drill-down, Settings push
- `docs/designs/revlog-mobile-garage.html` — Garage screen: vehicle list, offline state, empty state
- `docs/designs/revlog-mobile-log-entry.html` — log entry creation form
- `docs/designs/revlog-mobile-settings.html` — Settings screen
- `docs/designs/revlog-mobile-offline-sync.html` — offline indicator: all four states

### App

- `apps/mobile/CLAUDE.md` — architecture rules, layer rules, styling enforcement, testing policy, offline-first rules

### Milestones

- `docs/milestones/v1.md` — expanded Mobile section with full checklist
- `docs/milestones/v2.md` — added Mobile section with V2 deferred items

---

## Verification

Planning session — no code to verify. All ADRs cross-reference each other correctly. Spec use case IDs follow the `UC-MOB-<AREA>-N` convention throughout.

---

## Out of Scope (deferred to V2)

- Media / photo attachment on log entries
- Vehicle photo upload on mobile
- Push notifications (APNs + FCM)
- Deep linking — Universal Links (iOS) + App Links (Android) — for transfers, verification, and reset
- Transfer acceptance on mobile (requires deep linking)
- Playwright migration for web E2E (Cypress stays for V1)
- Incremental sync with cursor / watermark
- User-facing conflict resolution UI
- Biometric unlock
- OAuth sign-in on mobile
- Account editing from Settings
- EAS Build CI pipeline
