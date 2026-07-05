# Session: Mobile Settings Screen

**Date:** 2026-07-05
**Branch:** `worktree-mobile-settings-screen` (worktree; draft PR, not merged to main)

---

## Goal

Build the mobile Settings screen and its entry point from the Garage header. A spec (`docs/specs/mobile-app/settings.md`) and design (`docs/designs/mobile/revlog-mobile-settings.html`) existed from a prior session but the screen was still a `ScreenPlaceholder`. The feature set was re-scoped with the user during the session (see below), which pulled in two net-new backend endpoints and a small offline-cache + preference-storage layer on mobile.

---

## Key Decisions

| Decision | Choice | Reason |
|---|---|---|
| Garage → Settings entry point | Gear icon (top-right of the Garage header), not the round avatar originally floated | The app has no name/email to render avatar initials; the existing spec already specified a gear. User chose gear over wiring identity just for an avatar |
| Account name/email source | New authenticated **`GET /users/me`** endpoint (ADR 0033) | Nothing in the app exposed the Owner's name/email (`Session` carries only IDs; the web app has no account page to mirror). `/users/me` is an id-less self alias — no IDOR surface — with `/users/:id` reserved for the V2 admin "manage users in an account" use case |
| Account section offline behaviour | Offline-first **cached**, shows stale data offline (not online-only with a loading state) | User preference: stale-but-present beats a loading/unavailable state. Cached in a single-row `user_profile` SQLite table via `ProfileRepository`, pulled by `SyncService` (network I/O stays in SyncService per the offline rules); read-only pull, no outbox |
| Logout | **Online-required** `POST /auth/logout` (ADR 0034): revoke the refresh token server-side, then discard the local session | A logout that leaves a valid refresh token alive server-side isn't a real logout. A server *response* (incl. a 401 for an already-invalid token) completes logout locally; only a genuine network failure blocks it and shows "You need to be online to log out." Reverses the spec's old best-effort wording |
| Logout confirmation UI | State-driven `Modal` dialog (like Delete Vehicle), not a native `Alert` | The app has zero `Alert.alert` usages; confirmations are state-driven dialogs — more consistent and testable |
| Language | Selector + persisted preference **only** — no i18n library, no string translation (ADR 0035) | Full internationalization is a larger later-V1 effort with its own ADR/spec. The stored locale (en / pt-BR / es) seeds it. Persisted in `expo-secure-store` via a new `preferences` module (no new dependency; survives logout + cold start, unlike the tokens) |
| Account editing (name/email/password) | Out of scope | Sensitive mutations; will be an online-only, OTP-confirmed flow in a separate future effort |
| Biometric unlock | Promoted from V2 to a **V1 TODO** (auth spec + milestone) | User request; the fast path back in after the cold-start session clear. Needs its own spec + ADR before build — not part of this task |
| Web settings screen | Noted as separate later work | Dropped the spec's "unique to mobile" framing per the user — web will get its own |

---

## What Was Built

Docs-first, then step-by-step commits (worktree branch `worktree-mobile-settings-screen`).

### Documentation (`docs: … GET /users/me, online-required logout, language selector` — 54f5b1c)
- **ADR 0033** (`GET /users/me` + offline-cached profile), **ADR 0034** (`POST /auth/logout` + online-required mobile logout), **ADR 0035** (language selector + persisted locale, i18n deferred)
- New API specs `docs/specs/user/user-api.md`, `docs/specs/auth/logout-api.md`
- `settings.md` updated (cached account, language UC-MOB-SETTINGS-4, online-required logout, gear entry); `auth.md` (online-required UC-MOB-AUTH-6, biometry → V1 TODO); v1 milestone

### Backend
- **`GET /users/me`** (`feat(api)` — 1e21ba2): `UserService.getCurrentUser` (public projection, never `passwordHash`, 404 when gone), `createUsersRouter` behind `authenticate` reading `req.auth.sub`; api-client `getCurrentUser` + `UserProfile`
- **`POST /auth/logout`** (`feat(api)` — e78b7da): `AuthService.logout` (idempotent refresh-token revocation by hash), route behind `authenticate` (header or cookie); api-client `logout`; `TokenHttpClient` now injects `Refresh-Token` on the logout path and skips proactive refresh for logout (so an offline logout can't wipe the session via a failed refresh)

### Mobile
- **Gear entry** (`feat(mobile)` — db6f8cf): `useGarageViewModel.onOpenSettings`, round gear button (`GearIcon`) in the Garage header
- **Offline profile cache** (`feat(mobile)` — f2b7a93): `user_profile` table + `ProfileRepository` (`replaceAll` so a new user's login replaces the row); `SyncService.pull()` caches `GET /users/me` (optional dep, guarded — a fetch failure keeps the cached row); wired through `DatabaseProvider`/`SyncProvider` (field optional on the context/deps so existing mocks keep type-checking)
- **Settings screen** (`feat(mobile)` — f3e7207): `useSettingsViewModel` + `SettingsScreen` — own header, Account (offline-first), Legal/Support via `Linking.openURL`, online-required logout dialog; `app/_layout` hides the native header for the settings route
- **Language selector** (`feat(mobile)` — cbbbce9): `domain/locale` (en/pt-BR/es), `infrastructure/storage/preferences` (get/set locale over secure-store), Preferences → Language row + picker modal

### Tests (`test(mobile)` — 8816b19, 66d2c5c)
- Unit tests co-located with each change (user/auth service + route, ProfileRepository, SyncService profile pull, garage `onOpenSettings`, settings viewmodel incl. logout success/server-error-completes/network-error-blocks, preferences)
- `apps/mobile/e2e/specs/settings.e2e.ts` (registered in `wdio.shared.conf.ts`): open from gear + sections present, change language, logout → login

---

## Verification

- **API:** `pnpm --filter @maintenance-log/api test` → **286/286 pass** (18 files)
- **Mobile:** `pnpm --filter @maintenance-log/mobile test` → **252/252 pass** (24 files)
- **Typecheck:** `apps/api` and `apps/mobile` (`tsc --noEmit`) clean for all changed files; e2e specs typecheck against `e2e/tsconfig.json`
- **Pre-commit hook** (raw-hex scan) passed on every commit; no inline `style={{}}` or raw hex in new files
- **Not run here:** the Appium E2E requires a simulator/emulator + running dev API + Mailpit (as do the other specs); ESLint isn't installed in this environment — both to be run in the developer's environment

---

## Out of Scope / Follow-ups

- **Full internationalization** (translate app strings, device-locale default via `expo-localization`) — later V1 effort, own ADR + spec (ADR 0035). The selector persists a locale but nothing translates yet
- **Account name/email/password editing** — future online, OTP-confirmed flow
- **Biometric unlock** — V1 TODO in `auth.md`; needs its own spec + ADR
- **Web settings screen** — separate later effort
- The design HTML (`revlog-mobile-settings.html`) was not updated to add the Language section (mockup only; the spec documents it)
- Per the background-job workflow this branch ships as a **draft PR**, not merged to `main` (overriding the usual "merge the worktree" step)
