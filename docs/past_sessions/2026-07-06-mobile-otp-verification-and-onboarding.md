# Session: Mobile OTP Email Verification & Onboarding Wizard

**Date:** 2026-07-06
**Branch:** worktree `otp-verification-and-onboarding` (no remote configured; **not merged this session** — see Verification)

---

## Goal

Implement the **mobile onboarding flow**. Investigation showed a prerequisite gap: the mobile `verify-email` screen was an unbuilt placeholder, and the link-based email verification it depended on **cannot complete in-app** — a verification link tapped on a phone opens the browser, and deep linking is explicitly V2. So the work split, at the user's direction, into two features built in sequence:

1. **OTP email verification** (upstream) — replace the link with a 6-digit code entered in the app.
2. **Mobile onboarding wizard** (the original ask) — add a first vehicle or skip.

---

## Key Decisions

| Decision | Choice | Reason |
|---|---|---|
| Verification mechanism | Retire the link; **unify web + mobile on a 6-digit OTP** (Option B) | The link is a dead end on mobile without deep linking (V2); OTP closes the loop in-app. User chose "B, less debt" over running two mechanisms. |
| OTP parameters | 6 numeric digits, 10-min expiry, 4 attempts (1 + 3), hashed at rest | User-specified. The attempt cap — not code length — is the brute-force defence. See ADR 0037. |
| Verify enumeration safety | Unknown email → same `code_expired` as a real expired code; resend always 200 | Keeps verify no cleaner an enumeration oracle than `register`'s 409. Two slugs (`invalid_code`/`code_expired`) exist for UX (retry vs resend), not to reveal state. |
| Onboarding connectivity | **Online-only** | Reached only right after an online OTP verify / login; dissolves the offline-onboarding edge. User's call. |
| First-vehicle creation on mobile | `VehicleRepository.create` (SQLite + outbox), **not** a direct POST | Mobile offline-first rules: syncable data goes through the repository so the Garage reads it offline afterward. Intentional divergence from the web wizard (which POSTs directly). |
| Account-status resolution | Optimistic in-memory flip via new `AuthProvider.resolveOnboarding` + cached-credential update | Mirrors the web wizard's `activateAccount`. Server confirms independently (skip endpoint, or the outbox `POST /vehicles`); the local flip prevents an immediate re-route into onboarding. |
| Skip | `skipOnboarding(tokenHttpClient)` directly | Online-only op never persisted locally — same rule login/register follow. |

---

## What Was Built

Doc-first, one logical step per commit.

### Feature 1 — OTP email verification

- **`docs/adr/0037-email-verification-otp.md`** (new) — the decision, parameters, enumeration analysis, data-model change, rejected alternatives. (`8e911dc`)
- **Spec amendments** — `register-api.md` (new `POST /auth/verify-email {email,code}` + `/resend` contract), `verify-email.md` (web code-entry form), `mobile-app/auth.md` (UC-MOB-AUTH-2/3 in-app OTP). Originals kept; changes appended as dated Update/Amendment sections. (`49cd29a`)
- **Backend** (`62b8088`) — `User` verification columns swapped (`verificationCodeHash`/`…ExpiresAt`/`…AttemptsRemaining`) + Prisma migration; `AuthService.register`/`verifyEmail`/`resendVerification` + a CSPRNG code generator; `IUserRepository` set/decrement/clear methods; email now carries the code. **300 API tests pass.**
- **api-client + web** (`1dd5501`) — `verifyEmail` POSTs; `resendVerification` added. Web `verify-email` is now an RHF code-entry form mapping `invalid_code`/`code_expired` to retry/resend copy; Cypress reworked.
- **Mobile verify screen** (`3859044`) — built the real screen (`tokenHttpClient`, online-only), routing by account status. The Mailpit E2E fixture now reads the 6-digit code and POSTs to verify. 9 viewmodel tests + Appium happy/wrong-code/resend specs.

### Feature 2 — Mobile onboarding wizard

- **`docs/specs/mobile-app/onboarding.md`** (new) + v1 milestone link. (`80a9199`)
- **Wizard** (`5ac2f4e`) — 3-step screen (Welcome → Your vehicle → Ready) + viewmodel; `AuthProvider.resolveOnboarding`; Step 2 via `VehicleRepository`, skip via `skipOnboarding`. 11 viewmodel tests + Appium happy/skip specs; login & verify E2E updated to assert the real onboarding screen.

---

## Verification

- **API:** `pnpm --filter @maintenance-log/api test` — **300 passed**.
- **Mobile:** `pnpm --filter @maintenance-log/mobile test` — **326 passed**; `type-check` clean.
- **Web:** lint clean; verify-email files type-clean. (Repo-wide `type-check` has **pre-existing** failures unrelated to this work — a `next/link`/React-types skew across ~12 untouched screens, and test-file `delete`/fixture type errors; the API `type-check` likewise has pre-existing test-file errors. None involve files changed here.)
- **Appium E2E and Cypress were not executed** (no simulator/browser + live API/Mailpit in this environment); specs are written to match existing patterns and run in CI.
- **Not merged.** No git remote is configured, and this session ran under a constraint against auto-merging to `main`. The branch `otp-verification-and-onboarding` holds all seven commits, ready for review + merge. Note: `CLAUDE.md`'s workflow asks for a merge into `main` as the closing step — left to the user.

---

## Out of Scope / Follow-ups

- **Resend rate-limiting** (anti email-bombing) — noted in ADR 0037 as a hardening follow-up, not a V1 blocker.
- **Vehicle photo during onboarding** — the design's field set (make/model/year/mileage/nickname) excludes it; photos live on the Add Vehicle screen.
- **Make/Model/Year reference dataset** — still free-text (tracked on the web onboarding spec).
- **Running the E2E suites** against a device + live backend to confirm the Mailpit code-reader and the wizard flows end-to-end.
