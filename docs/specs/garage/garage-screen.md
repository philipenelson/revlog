# Garage Screen Spec

**Area:** Garage
**Route:** `/garage`
**Status:** UI complete (stubbed vehicle data — wiring `GET /vehicles` is the tracked follow-up; see Next steps)
**Last updated:** 2026-06-07

---

## Overview

The Garage is the Owner's home base — a grid of every Vehicle registered to their Account, each showing its odometer reading and Log Entry count, plus quick paths to a Vehicle's service history and to registering a new one. It's the landing destination after onboarding, whether the wizard is completed ([UC-ONBOARD-1 step 7](../onboarding/onboarding-wizard.md#uc-onboard-1--complete-onboarding-by-adding-a-first-vehicle)) or skipped ([UC-ONBOARD-2](../onboarding/onboarding-wizard.md#uc-onboard-2--skip-onboarding)), and the primary navigation hub for a returning Owner.

This spec implements the approved design preview at `docs/designs/revlog-garage-preview.html`, reusing the dark "cockpit" aesthetic and design tokens introduced across the rest of the app (see [ADR 0005](../../adr/0005-design-system-and-visual-identity.md)). It introduces the vehicle-card grid pattern that the Vehicle detail and Add Vehicle screens will build on.

---

## Layout

- **Top bar** — Revlog wordmark, an "Add vehicle" action, and the signed-in User's avatar (initials)
- **Page header** — eyebrow ("Your garage"), a title that interpolates the Vehicle count ("3 vehicles") or reads "Your garage" when empty, and a sub-line ("Sorted by most recently logged") shown only when the Garage is populated
- **Populated state** — a responsive grid of Vehicle cards (glyph, name, make/model/year, odometer + Log Entry count stats, "View service history" link) plus a dashed "Add a vehicle" tile as the grid's final cell
- **Empty state** — a centered illustration (dashed motorcycle silhouette in a circular bay with a glowing "+" badge), headline, supporting copy, and a single primary "Add your first vehicle" CTA

---

## Use cases

### UC-GARAGE-1 — View a populated garage

**Actor:** Owner with one or more Vehicles in their Garage
**Precondition:** User is authenticated; Account has at least one Vehicle
**Milestones:** [V1](../../milestones/v1.md)

1. User navigates to `/garage` (directly, via the top bar, or redirected here from onboarding)
2. System renders the page header with the Vehicle count and "Sorted by most recently logged"
3. System renders one card per Vehicle: glyph, display name (Nickname, or "Make Model" when no Nickname is set — matching [UC-ONBOARD-1](../onboarding/onboarding-wizard.md)'s naming rule), "Make · Model · Year", current odometer reading, and Log Entry count
4. A Vehicle with zero Log Entries shows "No entries yet" in place of a count, visually de-emphasised
5. System renders a dashed "Add a vehicle" tile as the last grid cell

---

### UC-GARAGE-2 — View an empty garage

**Actor:** Owner with zero Vehicles (skipped onboarding, or removed their only Vehicle)
**Precondition:** User is authenticated; Account has no Vehicles
**Milestones:** [V1](../../milestones/v1.md)

1. User lands on `/garage` (e.g. redirected here after selecting "Skip for now" in onboarding — [UC-ONBOARD-2](../onboarding/onboarding-wizard.md#uc-onboard-2--skip-onboarding))
2. System renders the page header reading "Your garage" with no count and no "Sorted by…" sub-line
3. In place of the grid, system renders the empty-state illustration, a headline ("Your garage is empty"), supporting copy explaining what adding a Vehicle unlocks, and a single primary "Add your first vehicle" CTA

---

### UC-GARAGE-3 — Open a Vehicle's service history from the garage

**Actor:** Owner viewing a populated garage
**Precondition:** User is on `/garage` with at least one Vehicle card visible
**Milestones:** [V1](../../milestones/v1.md)

1. User selects a Vehicle card (the entire card is the target, matching the approved design's `<a>`-wrapped card)
2. System navigates to that Vehicle's detail screen at `/garage/[vehicleId]`

> The Vehicle detail screen itself is a separate, not-yet-built milestone item ("Vehicle detail screen" — [V1 Garage/Vehicle](../../milestones/v1.md)). This use case covers the Garage's responsibility — surfacing the link and routing to the right place — not the destination screen's content.

---

### UC-GARAGE-4 — Start adding a Vehicle from the garage

**Actor:** Owner on `/garage`, with or without existing Vehicles
**Precondition:** User is authenticated
**Milestones:** [V1](../../milestones/v1.md)

1. User selects an "Add vehicle" affordance — the top bar action, the populated grid's dashed tile, or the empty state's primary CTA (all three are equivalent entry points to the same flow)
2. System navigates to the Add Vehicle screen at `/garage/add`

> Like UC-GARAGE-3, the Add Vehicle screen is a separate, not-yet-built milestone item ("Add vehicle screen" — [V1 Vehicle](../../milestones/v1.md)). This use case covers only the Garage's three equivalent entry points and where they lead.

---

## Acceptance Criteria

### Populated state

- [x] Page header shows "N vehicles" (correctly pluralised for `N === 1`) and "Sorted by most recently logged"
- [x] One card renders per Vehicle, each showing: glyph, display name (Nickname, falling back to "Make Model"), "Make · Model · Year", odometer with a "mi" unit, and Log Entry count
- [x] A Vehicle with `0` Log Entries renders "No entries yet" in the count's place, styled distinctly from a numeric count (`is-empty` treatment from the design)
- [x] Each card is a single navigable target leading to `/garage/[vehicleId]`
- [x] A dashed "Add a vehicle" tile renders as the grid's final cell and leads to `/garage/add`
- [x] Top bar "Add vehicle" action also leads to `/garage/add`

### Empty state

- [x] Renders in place of the grid when the Garage has zero Vehicles
- [x] Page header reads "Your garage" with no count and no "Sorted by…" sub-line
- [x] Illustration, headline ("Your garage is empty"), supporting copy, and a single primary "Add your first vehicle" CTA are shown
- [x] The CTA leads to `/garage/add`

### General

- [x] Top bar renders the Revlog wordmark/logo and the signed-in User's avatar (initials)
- [x] Page title is "Revlog — Garage" (or equivalent)
- [x] Domain language matches [`CONTEXT.md`](../../../CONTEXT.md): "Vehicle," "Garage," "Owner," "Log Entry" — never "fleet," "inventory," or "bike/motorbike" in code-facing strings (UI copy may say "bike" informally, matching the approved design's "Tell us about your bike")
- [x] No "service due" / scheduled-maintenance language or indicators — Scheduled Maintenance Items are V2-only (see [Not in V1](../../milestones/v1.md#not-in-v1))
- [x] An error boundary wraps the page per the root observability rules

### E2E tests (Cypress)

- [x] Populated garage renders the header count, all Vehicle cards with their stats (including the `is-empty` "No entries yet" card), and the "Add a vehicle" tile
- [x] Selecting a Vehicle card navigates to `/garage/[vehicleId]`
- [x] Selecting the "Add a vehicle" tile, the top bar action, and (separately, once reachable — see Next steps) the empty state's CTA all navigate to `/garage/add`
- [ ] Empty-state rendering and its CTA — blocked on real vehicle data; see "Empty-state E2E coverage" under Next steps

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Vehicle data source | **Stubbed mock data** matching the approved design's three example Vehicles; `GET /vehicles` is implemented later and swapped in | Mirrors the onboarding wizard's "ship the UI first against the approved design, wire the network call as the next concrete step" precedent ([onboarding-wizard.md Decisions](../onboarding/onboarding-wizard.md)) — `GET /vehicles` doesn't exist yet and is explicitly out of scope of [vehicle-creation-api.md](./vehicle-creation-api.md) |
| Garage state shown by default | **Populated**, with mock data covering both a normal and a zero-Log-Entry (`is-empty`) card | The populated grid is the steady-state experience for a returning Owner and exercises the most UI surface (cards, stats, both stat-block variants, the add tile). The empty state is fully built from the same approved markup but is only reachable today via a zero-length Vehicle list — which requires real data to occur naturally |
| Card is a single link | Whole `vehicle-card` is one navigable element (`<Link>`), not a card with a nested button/link | Matches the approved design's `<a class="vehicle-card">` and is the simplest accessible structure — there is exactly one destination per card |
| Forward-linking to not-yet-built screens | `/garage/[vehicleId]` (Vehicle detail) and `/garage/add` (Add vehicle) are wired now even though neither screen exists yet | Same precedent as the onboarding wizard linking to `/garage` before this spec existed — ship the navigable surface, build the destination as the next concrete milestone item ("Vehicle detail screen", "Add vehicle screen" — [V1 milestone](../../milestones/v1.md)) |
| Avatar / current-user identity | Mocked (`"Jordan Reyes"` / "JR", matching the design preview) | No auth context or current-user data is wired into the web app yet (`Next.js middleware for route protection` is still `[ ]` in the V1 milestone); the avatar is presentational chrome here, not a feature this screen owns |
| Sort order | Sub-line text only ("Sorted by most recently logged"); mock data is presented in a fixed order | Real "most recently logged" ordering requires Log Entry data, which doesn't exist yet (Log Entry is its own unimplemented V1 area). The label documents the intended V1 behaviour for when that data lands |

---

## Next steps (tracked follow-up — still V1 scope)

### Wire the garage to real Vehicle data
`GET /vehicles` is the natural data source for this screen but is explicitly out of scope of [vehicle-creation-api.md](./vehicle-creation-api.md) and not yet built:
- Spec + implement `GET /vehicles` (list Vehicles scoped to the caller's Account, per the same `authenticate` + account-scoping pattern as `POST /vehicles`)
- Replace the stubbed mock Vehicle list with a real fetch (loading and error states, mapped through the client logger per `apps/web/CLAUDE.md`)
- Replace the mocked avatar/current-user with real session data once an auth context exists

### Empty-state E2E coverage
The empty state is fully implemented from the approved design but cannot be reached today without a Garage that genuinely has zero Vehicles — which requires the real data wiring above. Add a Cypress scenario (e.g. against a seeded zero-Vehicle test Account, or an intercepted `GET /vehicles` returning `[]`) once that lands.

### Build the Add Vehicle and Vehicle detail screens
This spec wires `/garage/add` and `/garage/[vehicleId]` as navigation targets (see Decisions — "Forward-linking to not-yet-built screens"); both are separate, already-tracked V1 milestone items ("Add vehicle screen", "Vehicle detail screen") requiring their own specs.

### Real "most recently logged" ordering
Once Log Entries exist, sort the Vehicle grid by each Vehicle's most recent Log Entry timestamp (falling back to creation date for Vehicles with none), matching the sub-line's stated behaviour.

---

## Out of scope

- `GET /vehicles` API contract and its wiring (tracked above as a Next step)
- Add Vehicle screen and Vehicle detail screen content (separate specs — tracked above and in [V1 milestone](../../milestones/v1.md))
- Search, filtering, and sort controls beyond the static "most recently logged" label
- Vehicle removal/archiving from the Garage (not a V1 concept)
- Organisational/multi-User Garages (V2 — see [`CONTEXT.md`](../../../CONTEXT.md) Account)
