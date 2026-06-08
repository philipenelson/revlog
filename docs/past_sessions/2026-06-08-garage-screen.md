# Session: Garage screen UI implementation

**Date:** 2026-06-08
**Branch/worktree:** `worktree-garage-screen`

---

## Goal

Build the Garage screen (`/garage`) — the user's vehicle list and entry point into the app post-onboarding — following the approved design preview at `docs/designs/revlog-garage-preview.html`, per the project's docs-first, tokens-only, fully-tested standards.

A separate agent was building the `GET /vehicles` backend in parallel in its own `garage-backend` worktree (continuing from `vehicle-creation-api.md`'s "out of scope" note). This session shipped the UI against stubbed local data rather than block on that work landing first — the same "ship UI, stub data, wire up later" pattern the onboarding wizard used successfully.

## Key decisions

- **Stubbed vehicle data, no network call yet.** `GET /vehicles` didn't exist on `main` when this session started. Three mock vehicles (`The Daily`, `Sunday Bike`, `Project Garage Find`) cover the populated, multi-vehicle, and zero-log-entries states the design calls for. Wiring real data is the documented follow-up.
- **Forward-link to not-yet-built screens.** Vehicle cards link to `/garage/[vehicleId]`, the grid tile and top-bar button link to `/garage/add` — neither route exists yet. This mirrors the onboarding wizard's precedent (it shipped linking to `/garage` before `/garage` existed) and was confirmed safe: Next.js `<Link>` performs client-side navigation and updates the browser URL even for unmatched routes, so the E2E navigation assertions pass against the real router.
- **`statValueEmpty` as a standalone modifier**, not a compound selector. The preview used `.stat-block.is-empty .stat-value`; refactored to a single modifier class applied directly to the value `<div>`, avoiding a meaningless empty wrapper class.
- **All raw shadow/color values mapped to existing design tokens** rather than inventing new ones — the preview's raw `rgba()` box-shadows and one raw `#080A10` hex all had exact or equivalent matches already in `tokens.css` (`--shadow-accent-btn`, `--shadow-accent-btn-hover`, `--shadow-card`, `--accent-contrast`).
- **Client component + separate `layout.tsx`.** The page needed `"use client"` for the (currently static) interactive grid, which can't export `metadata` — so a thin server-component `layout.tsx` carries the page title, following the same split used elsewhere in the app.

## What was built (4 sequential commits, doc-first)

1. `ad7afbb` — **Spec**: `docs/specs/garage/garage-screen.md` — 4 use cases (view populated/empty garage, open vehicle detail, start adding a vehicle), acceptance criteria, decisions table, tracked next steps; linked from `v1.md`'s Garage section
2. `94e401c` — **Implementation**:
   - `apps/web/src/app/garage/page.tsx` — top bar (brand, "Add vehicle" action, avatar), page header (eyebrow, vehicle count, sort sub-line), vehicle grid of cards (display name, make/model/year, odometer, log-entry count or "No entries yet", "View service history" link) + add-vehicle tile, and an empty-state layout
   - `garage.module.css` — full CSS module translating the preview 1:1 into camelCase classes, all values from design tokens
   - `error.tsx` — page-level error boundary logging via the shared client `logger`
   - `layout.tsx` — server component carrying `metadata`
   - `cypress/e2e/garage.cy.ts` — final E2E suite (not a throwaway visual check): top bar, populated header, per-vehicle card content, the zero-entries case, grid tile placement, and navigation to vehicle detail and add-vehicle screens

## Verification performed

- `pnpm exec cypress run --spec cypress/e2e/garage.cy.ts` → 7/7 passing
- Full suite `pnpm exec cypress run` (auth + garage + onboarding) → 18/18 passing, no regressions
- `pnpm exec tsc --noEmit` and `pnpm exec eslint --max-warnings 0 src/app/garage` → clean
- Dev server smoke-checked at `http://localhost:3000/garage` → HTTP 200

## Bumps in the road

- Initially reached for Playwright to screenshot the page for visual comparison against the preview. **Rejected by the user** — "this application uses cypress for e2e tests, we don't want to install playwright." Cleaned up the npx-fetched script; used Cypress exclusively from then on.
- Drafted a throwaway `_tmp/visual-check.cy.ts` spec just to drive a screenshot. **Rejected by the user** — "implement the final e2e tests to ensure development was done properly," not throwaway ones. Wrote the complete, final E2E suite directly instead — it became the test suite that ships with the feature.

## Explicitly out of scope (tracked for later, see spec's Next steps)

- Wiring the screen to real `GET /vehicles` data (the `garage-backend` session built this in parallel; main had already merged it as of this session's start — integrating it is the next follow-up)
- Empty-state E2E coverage — blocked on having a real account with zero vehicles to drive against
- Building the `/garage/[vehicleId]` detail screen and `/garage/add` screen (currently forward-linked, not built)
- Real "most recently logged" ordering (currently a label only; depends on the `LogEntry` model and the `garage-backend` session's `updatedAt`-proxy decision)
