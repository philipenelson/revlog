# Session: Onboarding backend implementation

**Date:** 2026-06-07
**Branch/worktree:** `worktree-onboarding-backend`

---

## Goal

The onboarding wizard frontend was already built but stubbed — Step 2 → Step 3 happened client-side with no network call, and "Skip for now" just navigated to `/garage` without persisting anything. This session implemented the backend that the wizard needs to become real.

## Key architecture decision

The onboarding spec had flagged an open question: how to persist "onboarding completed/skipped" so a user who skips (and still has 0 vehicles) isn't redirected straight back into the wizard — a redirect loop.

Resolved through discussion into **ADR 0015**: a two-state `AccountStatus` enum (`ONBOARDING | ACTIVE`) directly on `Account`, default `ONBOARDING`, one-way funnel (no backward transitions). Either creating a first Vehicle or an explicit skip flips it to `ACTIVE`.

Two alternatives were explicitly rejected:
- **3-state machine (`NEW → ONBOARDING → ACTIVE`)** — rejected because "email verification is a User concern, not Account" (the user's own framing); `User.emailVerified` already covers it, and duplicating it on Account would create a second source of truth.
- **Vehicle-count-based routing** — rejected as non-monotonic (deleting your only vehicle would funnel you back into onboarding).

A second design question came up later via `/btw`: should the verify-email response carry `account.status`, given that "verify-email is a user concern, not account"? Resolved as: yes — but reframed as an **auto-sign-in/session-routing concern**, not a verify-email concern. The endpoint issues tokens and signs the user in, so it must tell the client where to route — exactly what `/login` will need to do later too.

## Side decision: Make/Model data shape

Discussed whether to build a structured Make/Model/Year reference dataset now vs. ship free-text. Decided to **ship free text now**, but document the decision and a concrete migration path thoroughly (seed reference tables → add nullable FK columns → fuzzy-match backfill script with manual-review flagging → make FK required/retire free text), and track it as a v1 milestone follow-on item — see `docs/specs/garage/vehicle-creation-api.md` Decisions table.

## What was built (6 sequential commits)

1. `148ea51` — **ADR 0015**: Account status state machine
2. `2ce387a` — **Specs**: `docs/specs/garage/vehicle-creation-api.md`, `docs/specs/onboarding/onboarding-api.md`, plus cross-reference updates to `onboarding-wizard.md`, `login.md`, `register-api.md`, `v1.md`
3. `9a95698` — **DB migration**: `AccountStatus` enum + `Vehicle` Prisma model
4. `4a20f33` — **Domain package**: `DomainVehicle`/`IVehicleRepository`/`CreateVehicleData`, `AccountStatus`/`status`/`markActive`/`findById` on the account domain, `createVehicleSchema` Zod schema; also deleted stale placeholder types (`UserId`, `VehicleId`, `LogEntryId`, `Vehicle`, `LogEntry`) that contradicted the real model (vehicles belong to Accounts, not Users)
5. `60c461b` — **API**: `PrismaVehicleRepository`, `markActive`/`findById` on `PrismaAccountRepository`, `VehicleService`, `AccountService`, `POST /vehicles` route (first authenticated route in the codebase), `POST /onboarding/skip` route, composition-root wiring in `app.ts`, full Vitest coverage (17 new tests)
6. `ba1fcae` — **Verify-email response**: extended `VerifyEmailResult`/`GET /auth/verify-email` to include `account: { id, status }` so the client can route immediately post-auto-login without an extra round trip

## Verification performed

- `pnpm --filter @maintenance-log/api test` → 60/60 passing
- `pnpm --filter @maintenance-log/api type-check` → clean
- `prisma migrate status` → in sync, 3 migrations applied
- **Live smoke test** against the dev server + Mailpit + Postgres:
  - register → verify-email returned `account.status: "ONBOARDING"`
  - `POST /vehicles` → 201, DB query confirmed account flipped to `ACTIVE`
  - `POST /onboarding/skip` on a fresh account → `200 { status: "ACTIVE" }`, confirmed idempotent on a second call

## Notable bump in the road

The Prisma migration initially failed with `Error: The datasource.url property is required...` despite `prisma.config.ts` looking correct. Root cause: **the worktree was missing `apps/api/.env`** — it's gitignored, so creating the worktree never copied it from the main checkout. Fixed by copying it over, then running `npx prisma migrate dev` directly (the `pnpm --filter ... -- --name ...` wrapper was producing a malformed double-dash invocation).

## Explicitly out of scope (not done this session)

- Frontend wiring of the wizard's Step 2 submit / "Skip for now" button to the new endpoints (separate follow-up, RHF + Zod resolver migration)
- `POST /login` endpoint (doesn't exist yet)
- Make/Model/Year reference dataset (deferred per the decision above, tracked in `v1.md`)
