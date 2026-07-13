# Session: Web Account Menu

**Date:** 2026-07-13
**Branch:** `main` (background session configured to work in place, no worktree)

---

## Goal

Give the web app a settings entry point "somewhat consistent" with mobile's full-screen Settings (`docs/specs/mobile-app/settings.md`): account info, legal links, support contact, and logout, reachable from the Garage screen.

---

## Key Decisions

Put to the user before writing anything, since these are scope calls, not mechanical choices:

| Decision | Choice | Reason |
|---|---|---|
| Sections in scope | Account, Legal, Support, Logout | Matches mobile minus Language (needs its own web persistence decision — deferred) and biometrics (mobile-only concept) |
| Entry point | Avatar dropdown, not a dedicated `/settings` route | User's own proposal: every mobile Settings link already has a first-class in-app destination on web (`/terms`, `/privacy`, `/cookies`), so a full page would just be a detour |
| Account info in the dropdown | Yes — name/email header above the links | Confirms who's logged in before showing destructive actions |
| Support destination | `mailto:hello@revlog.app` | Mobile's Support opens revlog.dev because the app has no other way to reach the website; web is already on revlog.dev, so linking to itself is redundant — the legal pages already use this address |
| Legal links | In-app `next/link` navigation | Standard behavior for every other internal link in the app |

See [`docs/specs/web/account-menu.md`](../specs/web/account-menu.md) for the full spec (use cases, acceptance criteria, out-of-scope items).

---

## What Was Built

Doc-first, one logical step per commit.

- **Spec + milestone** (`4177039`) — `docs/specs/web/account-menu.md` (new); `docs/milestones/v1.md` Garage section gets the account-menu line item.
- **Implementation** (`ef19584`) — `useGarageViewModel.ts` gains an `accountMenu` sub-object: fetches `GET /users/me` once on mount (no local cache — web has no offline story, unlike mobile's `ProfileRepository`), toggle/close state, and `onLogout` calling `POST /auth/logout` via `cookieHttpClient` with mobile's ADR 0034 semantics (a server response — success or error status — completes logout locally; only a network failure keeps the session and surfaces an error). `GarageScreen.tsx` replaces the hardcoded `CURRENT_USER` placeholder avatar with a real button + dropdown (`AccountMenuTrigger`/`AccountMenu`/`AccountMenuInfo`), following the existing DeleteConfirmDialog pattern for outside-click/Escape dismissal. New CSS in `garage.module.css`, tokens only. Pure helpers `initialsFromName` and `isLogoutNetworkFailure` added at module scope per the pure-core/hook-shell pattern (ADR 0043).
- **Tests** — `useGarageViewModel.test.tsx` extended with hook-shell coverage for the account menu (profile fetch, toggle/close, logout success/server-error/network-failure) and pure-function tests for the two new helpers (22 tests total, all passing). `cypress/e2e/garage.cy.ts` gets a `GET /users/me` stub in the shared `signIntoGarage` helper (every Garage mount now fetches it) and a new `describe("account menu", ...)` block: open/close (outside click + Escape), legal-link navigation, logout success, logout network failure.

---

## Verification

- `pnpm --filter @maintenance-log/web test` — **153 passed** (19 files), up from 148 pre-session.
- `pnpm --filter @maintenance-log/web exec tsc --noEmit` — clean.
- `pnpm --filter @maintenance-log/web exec eslint .` — clean, zero warnings.
- **Cypress**, run headlessly against a local `next dev` server: `garage.cy.ts` — **21/22 passing**. The 1 failure ("failed load ... recovers when retried") reproduces identically on unmodified `main` (verified via `git stash`) — a pre-existing flake unrelated to this change. All 5 new account-menu tests pass.

---

## Out of Scope / Follow-ups

- Language selector for web — needs its own ADR (persistence mechanism; ADR 0035 is `expo-secure-store`-specific and doesn't transfer)
- Account name/email/password editing — future online + OTP-confirmed flow, same as mobile
- A standalone `/settings` route — explicitly decided against; revisit only if the dropdown's content outgrows it
