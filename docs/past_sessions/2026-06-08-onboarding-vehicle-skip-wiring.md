# Session: Wire onboarding's vehicle creation and skip to the backend

**Date:** 2026-06-08
**Branch/worktree:** `worktree-garage-wire-backend`

---

## Goal

A live bug report: signing in as `ph@ph.com`, completing the wizard by "adding" a bike, landing on the garage — and finding the bike absent, then being redirected straight back to `/onboarding` on the next login. Root cause traced to a known, documented gap: the wizard's Step 2 "Continue" and "Skip for now" actions were pure client-side stubs (per [`onboarding-wizard.md`](../specs/onboarding/onboarding-wizard.md)'s prior Status line, "wiring Step 2's stubbed submit... is the remaining tracked follow-up"). Neither ever called `POST /vehicles` or `POST /onboarding/skip`, so `accountRepo.markActive` never ran, the Account stayed `ONBOARDING`, and `routeForAccountStatus` kept sending the user back into the wizard — a redirect loop. This session wired both actions to the real endpoints, closing the loop.

## Key decisions

- **Reused the two-tier `ApiError` messaging pattern from `/login`** — `if (err instanceof ApiError && err.status < 500)` shows a friendly inline message (`VEHICLE_SAVE_ERROR` / `SKIP_ERROR`); anything else logs via `logger.error` and shows the same generic `SERVICE_ERROR` copy as login, for tone consistency across the app's first-five-minutes flow.
- **Activate the session locally on success** — added an `activateAccount()` helper that calls `setSession({ ...session, account: { ...session.account, status: "ACTIVE" } })`, mirroring the `ONBOARDING → ACTIVE` transition `accountRepo.markActive` performs server-side. Without this, the in-memory session would still read `ONBOARDING` until the next full sign-in.
- **Deliberately did NOT migrate to React Hook Form + Zod**, despite the spec's Next-steps literally calling for it. A live check (running a small script against `createVehicleSchema` from `packages/domain/`, since `zod` is a direct dependency there) showed `z.coerce.number()` produces raw, unfriendly messages for bad `year`/`mileage` ("Invalid input: expected number, received NaN") and silently coerces an empty mileage string to a valid `0`. Both would have regressed the UX of the existing hand-tuned `validateDraft()` (whose messages — "Enter a numeric year.", "Enter the current mileage." — the kept E2E specs assert on verbatim) and broken those tests. Kept `validateDraft()` as the gate in front of the network call instead, and documented the deviation explicitly in the spec's "Next steps" section with the reasoning, so the migration can be revisited if `createVehicleSchema` itself changes.
- **No new CSS** — both new inline error messages reuse the existing `styles.fieldError` class (Rule A/B compliance).

## What was built (1 commit)

`8b70b7d` — **fix(web): wire onboarding's vehicle creation and skip to the real backend**
- `apps/web/src/app/onboarding/page.tsx`: `handleContinue` now `POST`s to `/vehicles` with `Authorization: Bearer ${session.accessToken}` after client-side validation passes, mapping the draft's strings to the typed payload (`year: Number(...)`, `mileage: Number(...)`, `nickname: ... || undefined`); new `handleSkip` `POST`s to `/onboarding/skip` the same way and redirects to `/garage`; both show pending states (`"Saving…"` / `"Skipping…"`, disabled buttons) and the two-tier error mapping; `activateAccount()` keeps the in-memory session in sync with the real `ONBOARDING → ACTIVE` transition
- `apps/web/cypress/e2e/onboarding.cy.ts`: rewritten around a `signIntoOnboarding()` helper (mirrors `garage.cy.ts`'s `signIntoGarage` — drives the real login form with `POST /auth/login` intercepted to return an `ONBOARDING` account, so a genuine in-memory session exists before exercising the wizard's network calls). 12 specs: 4 unchanged pure-client-side specs (welcome rendering, both validation cases, Back navigation — none reach the network because `validateDraft()` returns early), plus 8 new network-backed specs covering the happy path (with request-body and bearer-token assertions), the no-nickname fallback, pending states, and 4xx-error-with-retry / 5xx-generic-error for both vehicle creation and skip
- `docs/specs/onboarding/onboarding-wizard.md`: flipped Status to "Implemented," rewrote the "Vehicle creation" and "Form validation approach" Decisions rows to describe the real wiring and the RHF/Zod deviation (with the zod-experiment reasoning), checked off the Step 2 and E2E acceptance criteria now covered, and replaced the "Wire Step 2..." Next step with a "Resolved" section documenting both what was built and the deliberate deviation

## Verification performed

- `pnpm exec tsc --noEmit` (apps/web) → clean
- `pnpm run lint` (apps/web) → clean
- Cypress run against an isolated `next dev -p 3100` instance (kept separate from the user's running dev/API/Cypress processes on 3000/3001, with a dummy `NEXT_PUBLIC_API_URL` so no real network traffic could escape the intercepts): **12/12 passing**

One test-design issue surfaced and was fixed during this run: `cy.intercept(...).as("skip")` failed with `cy.as() cannot be aliased as: 'skip'. This word is reserved` — Cypress reserves `skip` as an alias name (it collides with `it.skip`/`describe.skip` semantics). Renamed the alias to `skipOnboarding` throughout.

## Explicitly out of scope (tracked for later)

- Migrating the vehicle-draft form to React Hook Form + `createVehicleSchema` — deliberately deferred; see the "Form validation approach" Decisions row and the "Resolved" Next-steps entry for the full reasoning (the schema's `z.coerce.number()` messages are currently worse than the hand-tuned ones in place)
- The reference-dataset work for Make/Model/Year (tracked separately in the spec's "Build a reference dataset..." Next step) — untouched by this session
- Persisted partial wizard progress, multi-vehicle quick-add — both already tracked as V2 roadmap items
