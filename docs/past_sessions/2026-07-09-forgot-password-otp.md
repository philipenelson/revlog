# Session: Forgot Password (OTP reset)

**Date:** 2026-07-09
**Branch:** worktree `worktree-forgot-password-otp` (**not merged this session** — see Verification)

---

## Goal

Plan, design, and implement the **forgot-password flow** across the whole stack (API + mobile + web), so an Owner who has forgotten their password can recover access.

Investigation found the flow was entirely greenfield: both login screens link to a `/forgot-password` destination that was never built (web `<a href>` to a non-existent route; mobile a `ScreenPlaceholder`), there were no reset endpoints or `User` columns, and no spec. The only prior design was `mobile-app/auth.md` UC-MOB-AUTH-4 — a **link-based** reset (email → browser reset form) that was specced but never built, and which has the exact mobile dead-end [ADR 0037](../adr/0037-email-verification-otp.md) had just removed from email verification.

---

## Key Decisions

All three load-bearing calls were put to the user before writing anything (the link→OTP reversal overturns a documented decision, so it needed sign-off):

| Decision | Choice | Reason |
|---|---|---|
| Mechanism | **6-digit OTP, in-app on both clients** (supersedes the link flow) | Reuses ADR 0037's OTP idiom; no mobile browser bounce, no deep-linking (V2) dependency. Password reset is the canonical sensitive op — the same "online + OTP" idiom the app already committed to. |
| Scope | **API + mobile + web** in one pass | Full parity, the way ADR 0037 unified web + mobile. Nothing to migrate (all forgot-password surfaces were unbuilt). |
| Post-reset | **Auto-sign-in + revoke all other sessions + mark verified** | Smoothest recovery, consistent with verify-email. A reset evicts other/attacker sessions; a valid emailed OTP proves inbox control, so it also verifies — rescuing never-verified accounts in one flow. |
| OTP parameters | 6 digits, 10-min expiry, 4 attempts, bcrypt-hashed at rest | Identical to ADR 0037 — the OTP mechanism is deliberately shared. |
| Reset columns | **Separate** `passwordResetCode*` columns, distinct from `verificationCode*` | A reset code and a verification code can be live at once; conflating them lets one flow clobber the other. |
| Enumeration safety | `forgot-password` always 200; `reset-password` folds unknown-email into `code_expired` | No cleaner an oracle than register's 409 / verify's slugs. |
| Password validation | Extract a shared `passwordField` in the domain schema, referenced by **both** `registerSchema` and `resetPasswordSchema` | User-flagged: a reset must not set a password registration would reject. One source of truth; the two can't drift. |

See [ADR 0038](../adr/0038-password-reset-otp.md) and [`docs/specs/auth/forgot-password.md`](../specs/auth/forgot-password.md).

---

## What Was Built

Doc-first, one logical step per commit.

- **`docs/adr/0038-password-reset-otp.md`** (new) — the decision, parameters, session-invalidation/auto-sign-in/verify-on-reset semantics, enumeration analysis, rejected alternatives. (`ca725ad`)
- **Spec + milestone + amendment** — new `docs/specs/auth/forgot-password.md` (UC-AUTH-FP-1..3, shared web + mobile); v1 milestone entries; `mobile-app/auth.md` UC-MOB-AUTH-4 amended (link flow superseded, dated). (`af6dc61`)
- **Data layer** (`495d97d`) — `User` gains `passwordResetCode{Hash,ExpiresAt}` + `passwordResetAttemptsRemaining`; Prisma migration + regenerated client; `IUserRepository` set/decrement/clear + `resetPassword` (sets hash, verifies, clears); test fakes/fixtures updated.
- **Domain schemas** (`dc27e95`) — `forgotPasswordSchema`, `resetPasswordSchema`; extracted shared `passwordField` (registration + reset reference it).
- **API endpoints** (`ddc979b`) — `AuthService.forgotPassword` (enumeration-safe no-op for unknown email) + `resetPassword` (validate OTP → set password + verify + `deleteAllForUser` → auto-sign-in); `POST /auth/forgot-password` (always 200) + `POST /auth/reset-password`; `sendPasswordResetEmail` + `app.ts` wiring; service + route unit tests.
- **api-client** (`dc161b2`) — `forgotPassword` + `resetPassword` service functions.
- **Mobile** (`b86e617`) — `forgot-password` screen (email → request → advance) + new `reset-password` screen (code + new password → auto-sign-in, resend, routed by account status); both call `tokenHttpClient` directly (online-only). Viewmodel unit tests for every state/error path; reset route wired.
- **Mobile E2E** — `forgot-password.e2e.ts` (full reset happy path + wrong-code); `findPasswordResetCode` Mailpit reader (subject-filtered so it never grabs the stale verification email); `login.e2e.ts` forgot-link now asserts the real screen.
- **Web** (`2b0b034`) — `/forgot-password` + `/reset-password` screens/viewmodels/CSS + routes, mirroring the verify-email scene/card + success orb; `cookieHttpClient`; Cypress E2E for both screens. Login link already targeted `/forgot-password`.
- **Doc-pointer hygiene** — login.md / verify-email.md / register-api.md "when created / placeholder" refs updated now that the flow exists.

---

## Verification

- **API:** `pnpm --filter @maintenance-log/api test` — **326 passed** (18 files; +26 over the pre-session 300: service + route guard-clause coverage for both endpoints).
- **Mobile:** `pnpm --filter @maintenance-log/mobile test` — **348 passed** (33 suites), including the two new viewmodel test files.
- **Web:** ESLint clean on all new files; new forgot/reset files type-clean.
- **Pre-existing, unrelated failures (not introduced here):** the API and web repo-wide `type-check` were already red — a `next/link`/React-19 types skew across untouched screens (e.g. `VehicleDetailScreen`), and API test-file `IVehicleRepository`/`DomainVehicleDetail` fixture errors. None involve files changed this session. (I used plain `<a>` for the reset screens' links, matching the login screen, to avoid adding to the `next/link` skew.)
- **Appium E2E and Cypress were not executed** (no simulator/browser + live API/Mailpit in this environment); specs are written to existing patterns and run in CI.
- **Not merged.** This ran as a background job under a constraint against pushing to / merging `main`; the branch holds all commits for review. Per the harness workflow the branch is pushed and a **draft PR** opened instead of the CLAUDE.md-style merge into `main` — left to the user.

---

## Out of Scope / Follow-ups

- **Per-email rate-limiting** of reset requests (anti email-bombing) — a shared hardening follow-up with ADR 0037's resend; noted in ADR 0038 as a non-blocker.
- **Web password-reset error boundary** — mirrors the existing verify-email route's boundary situation; not added here (consistency with that precedent).
