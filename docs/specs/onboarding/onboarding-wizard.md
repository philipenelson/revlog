# Onboarding Wizard Spec

**Route:** `/onboarding`
**Status:** Implemented — Step 2's submit and "Skip for now" are wired to `POST /vehicles` and `POST /onboarding/skip`
**Last updated:** 2026-06-08

---

## Overview

A 3-step wizard shown immediately after a brand-new user's first sign-in (i.e. whenever the post-login/post-verification routing logic finds **zero vehicles** in the Account's Garage — see [UC-AUTH-1 step 5](../auth/login.md#uc-auth-1--sign-in-with-email-and-password) and [UC-AUTH-3 step 4](../auth/login.md#uc-auth-3--verify-email)). It walks the Owner through registering their first Vehicle so the Garage is never empty by accident — populated either through the wizard or explicitly skipped.

The wizard reuses the centered single-card pattern and atmospheric scene background introduced for `/verify-email` (dot-grid + radial teal glow on `surface-base`), keeping the "first five minutes" of the product visually cohesive. See [ADR 0005](../../adr/0005-design-system-and-visual-identity.md).

---

## Layout

**Centered single card, full viewport** (no split brand/form panel — there's no marketing copy to show mid-flow):

| Element | Content |
|---|---|
| Scene | `surface-base` background, dot-grid overlay, radial teal glow — atmospheric, not interactive |
| Card | `surface-raised`, `radius-xl`, max-width 440px, centered vertically and horizontally |
| Step indicator | "Gauge-tick" progress: 3 horizontal segments that fill left-to-right, active segment glows/pulses in `--accent` — extends the tachometer motif from the logo into progress UI |
| Step content | Swaps per step: Welcome copy + CTA → Vehicle form → Confirmation with spec plate |

Responsive behaviour follows the same `@media (max-width: 860px)` card-collapse pattern as `/login` and `/verify-email` — the card remains centered and shrinks to `width: 100%` with consistent side padding; no separate mobile layout is needed.

---

## Use Cases

### UC-ONBOARD-1 — Complete onboarding by adding a first vehicle

**Actor:** New Owner who has just signed in or verified their email with zero Vehicles in their Garage
**Precondition:** User is authenticated; Account's Garage is empty
**Milestones:** [V1](../../milestones/v1.md)

1. User lands on `/onboarding`, **Step 1 — Welcome** is shown with a short explanation and an "Add my first vehicle" CTA (plus a "Skip for now" link)
2. User selects "Add my first vehicle" → wizard advances to **Step 2 — Your vehicle**
3. User fills in: Nickname (optional), Make, Model, Year, Current mileage
4. User selects "Continue"
5. System validates the input client-side
6. **Valid:** wizard advances to **Step 3 — Ready**, showing a success orb, a "spec plate" summarising the entered data, and a "Go to my garage" button
7. User selects "Go to my garage" → redirected to `/garage`, where the new Vehicle now appears

**Errors:**

| Condition | Message shown |
|---|---|
| Required field empty (Make, Model, Year, Mileage) or Year/Mileage not numeric | Inline validation message under the offending field; "Continue" does not advance |

---

### UC-ONBOARD-2 — Skip onboarding

**Actor:** New Owner who does not want to add a vehicle immediately
**Precondition:** Same as UC-ONBOARD-1
**Milestones:** [V1](../../milestones/v1.md)

1. From **Step 1 — Welcome**, user selects "Skip for now"
2. User is redirected directly to `/garage`, which renders its empty state (see [garage spec](../garage/garage-screen.md) when created)
3. The wizard should not be shown again automatically on a future sign-in — an Owner who skips can always add a vehicle from the Garage's empty state or "Add vehicle" action

> **Open question — needs a decision before step 3 above can be implemented for real:** the post-login routing rule is currently "0 vehicles → Onboarding" (see the login spec). A user who skips still has 0 vehicles, so without an explicit "onboarding skipped/completed" signal stored somewhere, they'd be routed straight back into the wizard on their next sign-in — a loop. See **Persist onboarding completion/skip status** under Next steps; this is a backend/data-model decision, not a UI one, and does not block shipping the wizard UI itself (the stubbed skip action simply navigates to `/garage`).

---

### UC-ONBOARD-3 — Returning to onboarding mid-flow

**Actor:** Owner who navigates away (closes tab, hits back) before finishing the wizard
**Precondition:** Account still has zero Vehicles
**Milestones:** [V1](../../milestones/v1.md)

1. User revisits `/onboarding` (directly, or via the post-login redirect firing again)
2. Wizard restarts at **Step 1 — Welcome** — no partial-progress persistence in V1
3. Any data entered in a previous attempt is not retained

---

## Acceptance Criteria

### Step 1 — Welcome

- [ ] Step indicator shows segment 1 active, segments 2–3 inactive
- [ ] Headline + supporting copy explain what's about to happen, in plain language (no jargon like "Garage" without context for a first-time user)
- [ ] "Add my first vehicle" is the primary action (`btn-primary` styling) and advances to Step 2
- [ ] "Skip for now" is a secondary, low-emphasis text link that redirects to `/garage`

### Step 2 — Your vehicle

- [ ] Step indicator shows segment 1 done, segment 2 active (glowing/pulsing), segment 3 inactive
- [ ] Fields rendered, in order: Nickname (optional, placeholder "e.g. The Daily"), Make, Model, Year, Current mileage (with a "mi" unit suffix rendered inside the field)
- [ ] Nickname is the only optional field; all others are required
- [ ] Year and Current mileage use `inputMode="numeric"` and reject non-numeric input client-side
- [ ] Make and Model are **free-text inputs in this iteration** (see Decisions — structured selection from a reference dataset is a tracked follow-up, not a blocker for this ship)
- [ ] "Back" returns to Step 1 without losing any data entered so far in the current session
- [x] "Continue" runs client-side validation; on failure shows inline messages and does not advance; on success calls `POST /vehicles`, shows a "Saving…" pending state, and on success advances to Step 3 (on failure shows a two-tier inline error and stays on Step 2)
- [ ] Submitting via keyboard (Enter) behaves the same as clicking "Continue"

### Step 3 — Ready

- [ ] Step indicator shows all 3 segments done/active, segment 3 carries the glow
- [ ] Status orb plays the "verified" success animation (ring draw-in + checkmark), reusing the component introduced for `/verify-email`
- [ ] Headline interpolates the entered Nickname (or the Make + Model if no nickname was given), e.g. "The Daily is in your garage"
- [ ] Spec plate lists Nickname, Make & model, Year, and Mileage (with "mi" unit) exactly as entered, with the mileage value in `Geist Mono`
- [ ] "Go to my garage" redirects to `/garage`

### General

- [x] Page title is "Revlog — Set up your garage" (or equivalent reflecting the step) — set via `src/app/onboarding/layout.tsx`, matching the `/garage` route's pattern
- [ ] No "service due" / scheduled-maintenance language or indicators anywhere in the flow — Scheduled Maintenance Items are V2-only (see [Not in V1](../../milestones/v1.md#not-in-v1))
- [ ] Domain language matches [`CONTEXT.md`](../../../CONTEXT.md): "Vehicle," "Garage," "Owner" — never "fleet," "inventory," or "bike/motorbike" in code-facing strings (UI copy may say "bike" informally)
- [ ] An error boundary wraps the page per the root observability rules

### E2E tests (Cypress)

- [x] Step 1 renders with step indicator at segment 1 and both CTAs visible
- [x] "Add my first vehicle" advances to Step 2 and shows the vehicle form
- [x] Submitting Step 2 with empty or invalid required fields shows inline validation and does not advance (covers both the empty-field and non-numeric year/mileage cases)
- [x] Filling all required fields and continuing calls `POST /vehicles` (asserting the bearer token and request body), shows a pending state, and advances to Step 3 with the entered data reflected in the spec plate — including the no-nickname fallback to "Make Model"
- [x] A 4xx failure from `POST /vehicles` shows a friendly inline error and stays on Step 2; retrying recovers to Step 3. A 5xx failure shows the generic service-error message
- [x] "Back" from Step 2 returns to Step 1
- [x] "Skip for now" calls `POST /onboarding/skip` (asserting the bearer token), shows a pending state, and redirects to `/garage`; a failure shows a friendly inline error and retrying recovers
- [x] "Go to my garage" from Step 3 redirects to `/garage`

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Layout pattern | Centered single card (not split brand/form) | Matches `/verify-email` — interstitial screens have no marketing copy to show; consistency reduces visual whiplash in the first-five-minutes flow |
| Step indicator | New "gauge-tick" component (filling segments, `transform: scaleX()`) | Extends the tachometer-gauge visual language from the logo rather than introducing a generic dot-stepper |
| Step 3 success feedback | Reuse the `/verify-email` status-orb "verified" state | One motif for "operation succeeded" across the app — consistency over novelty |
| Vehicle creation | **Wired for real** — Step 2's "Continue" calls `POST /vehicles` with `session.accessToken`; on success the in-memory session's `account.status` flips to `ACTIVE` (mirroring what `accountRepo.markActive` just did server-side) and the wizard advances to Step 3. "Skip for now" calls `POST /onboarding/skip` the same way and redirects straight to `/garage`. Both show a pending state and map failures through the two-tier `ApiError` strategy (4xx → friendly inline message, 5xx/network → `logger.error` + generic message), matching `/login`'s precedent | This closes the redirect-loop bug: previously the stub never called `POST /vehicles`, so the Account never transitioned out of `ONBOARDING` and the post-login router kept sending the user back to `/onboarding` every time. See [vehicle-creation-api.md](../garage/vehicle-creation-api.md) and [onboarding-api.md](./onboarding-api.md) for the endpoint contracts |
| Form validation approach | **Kept the existing hand-written `validateDraft()`** — deliberately did *not* migrate to React Hook Form + `createVehicleSchema` as originally planned (see below) | A live check of `createVehicleSchema` showed `z.coerce.number()` produces raw, unfriendly messages for bad `year`/`mileage` input ("Invalid input: expected number, received NaN") and silently coerces an empty mileage string to `0` rather than failing validation — both a UX regression versus the tuned messages ("Enter a numeric year.", "Enter the current mileage.") and a break of the existing validation E2E specs that assert on them verbatim. `validateDraft()` still gates the request: the network call only fires once it returns no errors, so the schema's coercion quirks never reach the server in practice |
| Make / Model input | Free text for this iteration; structured selection from a reference dataset is a tracked follow-up | Avoids blocking the wizard ship on an undecided data source/schema shape (see Next steps); free text matches the approved design preview and is good enough until the dataset lands — at which point Make/Model become a refactor, not a rebuild |
| Wizard restart on revisit | No partial-progress persistence | Keeps V1 simple; the flow is short (3 steps, ~1 minute). Persisting partial state is a V2 nice-to-have if user research shows drop-off |
| Skip destination | `/garage` (empty state) | The Garage's empty state already carries its own "add your first vehicle" CTA — skipping doesn't strand the user, it just defers the decision |
| Fields collected | Nickname (optional), Make, Model, Year, Current mileage | Matches the "spec plate" data set approved in the design preview; deliberately excludes VIN, purchase date, photo upload — none of those are V1 Vehicle concepts |

---

## Next steps (tracked follow-up — still V1 scope)

### ~~Wire Step 2 to the real Vehicle creation endpoint~~ — Resolved
**Built:** Step 2's "Continue" now calls `POST /vehicles` (with a "Saving…" pending state and the two-tier `ApiError` mapping from `/login`), and "Skip for now" now calls `POST /onboarding/skip` the same way before redirecting to `/garage`. Both activate the in-memory session's `account.status` to `ACTIVE` on success — see the "Vehicle creation" Decisions row above. The E2E suite (`apps/web/cypress/e2e/onboarding.cy.ts`) covers the network-backed happy paths (including the no-nickname fallback and request/auth assertions), pending states, and 4xx/5xx failure-and-retry for both actions.

**Deliberate deviation — did not migrate to React Hook Form + Zod:** the original plan (below, as it read before this was resolved) called for migrating the form to RHF + `createVehicleSchema`. A live check of that schema showed `z.coerce.number()` turns invalid `year`/`mileage` input into raw messages ("Invalid input: expected number, received NaN") and silently coerces an empty mileage string to a valid `0` — both worse than the existing hand-tuned `validateDraft()` messages and a break of the validation E2E specs that assert on them verbatim. Kept `validateDraft()` as the gate in front of the network call instead; revisit the RHF/Zod migration only if `createVehicleSchema` itself is changed to produce friendlier, stricter messages.

### ~~Persist onboarding completion/skip status~~ — Resolved
**Decided:** [ADR 0015](../../adr/0015-account-status-state-machine.md) adds a two-state `AccountStatus` (`ONBOARDING | ACTIVE`) directly on `Account`. `POST /vehicles` and `POST /onboarding/skip` ([vehicle-creation-api.md](../garage/vehicle-creation-api.md), [onboarding-api.md](./onboarding-api.md)) both resolve onboarding by transitioning the Account from `ONBOARDING` to `ACTIVE` — closing the redirect-loop gap this section originally described. The [login spec](../auth/login.md)'s UC-AUTH-1 step 5 and UC-AUTH-3 step 4 have been updated to reference the resolved rule. Remaining work is purely client-side — see "Wire Step 2..." above.

### Build a reference dataset of vehicle makes, models, and years
Free-text Make/Model/Year invites duplicate/inconsicent data ("Triumph" vs "TRIUMPH" vs "Triumph Motorcycles Ltd") that would otherwise need a data-migration/normalization pass later. The plan is to seed a **comprehensive makes/models/years dataset into the database as V1 data** — getting this right from day one avoids that migration entirely.

Subtasks once a data source is selected:
- Decide the dataset's shape — the Make → Model → Year relation used in this spec's wizard fields is a **placeholder/suggestion**; the real shape (e.g. `Year → Make → Model`, or a displacement-inclusive `CC → Year → Make → Model`) depends entirely on what the chosen data source provides. Needs its own spec + [ADR](../../adr/) once a source is found
- Refactor the onboarding wizard's (and any future Add/Edit Vehicle screen's) Make/Model/Year fields from free text to **selection from this dataset**
- Add a "Can't find your bike? Add it manually" fallback that lets the Owner enter a custom Make/Model/Year not present in the dataset — the dataset accelerates data entry, it must never block it
- This is its own V1 feature with its own spec — it does not block shipping the wizard with free-text inputs first (Step 2 launches as specced above and is refactored in place once the dataset exists)

---

## V2 Roadmap Items

### Persisted partial progress
If a user closes the tab mid-wizard, restore their progress (Step + entered fields) on return, likely via a short-lived draft stored against the session.

### Multi-vehicle quick-add
Allow adding a second Vehicle directly from Step 3 ("Add another") instead of routing through the Garage — useful for Owners who manage multiple bikes from day one.

---

## Out of scope

- `/garage` screen and its empty state (separate spec: [garage-screen.md](../garage/garage-screen.md) when created)
- `POST /vehicles` API contract and Vehicle Prisma model — implemented; see [vehicle-creation-api.md](../garage/vehicle-creation-api.md)
- Vehicle makes/models/years reference dataset and its data source (separate spec + ADR, tracked above as a Next step)
- Add/edit Vehicle screen reachable from the Garage post-onboarding (separate spec)
- Mobile app onboarding (separate spec)
