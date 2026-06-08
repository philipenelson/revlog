# Garage Screen Spec

**Area:** Garage
**Route:** `/garage`
**Status:** Implemented — wired to `GET /vehicles` with loading, error, and no-session states
**Last updated:** 2026-06-08

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

### Data loading

- [x] On mount, the screen fetches `GET /vehicles` (authenticated via `session.accessToken`) and shows a loading state until it resolves
- [x] On success, the screen renders the populated grid or the empty state depending on the returned list's length
- [x] On failure, the screen renders an error state with a "Try again" action that re-fetches and recovers into the populated grid on success
- [x] If there is no in-memory session (e.g. the screen was reloaded — see Decisions, "No-session redirect"), the screen redirects to `/login` instead of attempting the fetch or rendering a load-error state

### General

- [x] Top bar renders the Revlog wordmark/logo and the signed-in User's avatar (initials)
- [x] Page title is "Revlog — Garage" (or equivalent)
- [x] Domain language matches [`CONTEXT.md`](../../../CONTEXT.md): "Vehicle," "Garage," "Owner," "Log Entry" — never "fleet," "inventory," or "bike/motorbike" in code-facing strings (UI copy may say "bike" informally, matching the approved design's "Tell us about your bike")
- [x] No "service due" / scheduled-maintenance language or indicators — Scheduled Maintenance Items are V2-only (see [Not in V1](../../milestones/v1.md#not-in-v1))
- [x] An error boundary wraps the page per the root observability rules

### E2E tests (Cypress)

- [x] Populated garage renders the header count, all Vehicle cards with their stats (including the `is-empty` "No entries yet" card), and the "Add a vehicle" tile
- [x] Selecting a Vehicle card navigates to `/garage/[vehicleId]`
- [x] Selecting the "Add a vehicle" tile, the top bar action, and the empty state's CTA all navigate to `/garage/add`
- [x] Empty-state rendering and its CTA, driven by an intercepted `GET /vehicles` returning an empty list
- [x] Loading state renders while `GET /vehicles` is in flight, then gives way to the populated grid
- [x] Failed load renders the error state and recovers to the populated grid when retried
- [x] Reloading the screen with no in-memory session redirects to `/login` instead of showing a load-error state

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Vehicle data source | Real fetch to `GET /vehicles` (see [garage-list-api.md](./garage-list-api.md)), authenticated via `session.accessToken` from `useAuth()`, with explicit `loading` / `loaded` / `error` states | `GET /vehicles` is implemented and spec'd as the contract for this screen; stubbing was only ever the placeholder until that endpoint and an in-memory session existed (see [ADR 0016](../../adr/0016-client-session-and-route-protection.md)) |
| Loading / error / retry handling | A `LoadState` of `"loading" \| "loaded" \| "error"` drives the body: a loading message while the request is in flight, an error state with a "Try again" action that re-issues the fetch, and either the populated grid or the empty state once `loaded` | Matches the pattern used elsewhere in the app (e.g. login/register — `apps/web/src/app/(auth)/login/page.tsx`) of mapping `ApiError` to a user-facing message and routing unexpected (5xx/network) failures through `logger.error`, while leaving 4xx responses silent in the log (expected, user-actionable) |
| No-session redirect | If `useAuth()` returns no session on mount, the screen redirects to `/login` via `router.replace` rather than attempting the fetch or showing a load-error state | Reloading `/garage` wipes `AuthProvider`'s in-memory session ([ADR 0016](../../adr/0016-client-session-and-route-protection.md) — "no session restoration on reload"); the refresh-token cookie still gets the visitor past middleware, but there is no access token to fetch with. The prior behaviour rendered the generic "couldn't load your garage" error with a "Try again" button that could never succeed (the fetch effect bailed on `!session`) — a dead end. Re-authenticating via `/login` is the only working recovery path until `POST /auth/refresh` exists, so the screen routes there directly |
| Garage state shown by default | Driven entirely by the `GET /vehicles` response — populated grid, empty state, or error state, whichever the data and request outcome dictate | No more mock data to curate; the screen now reflects the Account's real Vehicle list, including the zero-Vehicle case the empty state was built for |
| Card is a single link | Whole `vehicle-card` is one navigable element (`<Link>`), not a card with a nested button/link | Matches the approved design's `<a class="vehicle-card">` and is the simplest accessible structure — there is exactly one destination per card |
| Forward-linking to not-yet-built screens | `/garage/[vehicleId]` (Vehicle detail) and `/garage/add` (Add vehicle) are wired now even though neither screen exists yet | Same precedent as the onboarding wizard linking to `/garage` before this spec existed — ship the navigable surface, build the destination as the next concrete milestone item ("Vehicle detail screen", "Add vehicle screen" — [V1 milestone](../../milestones/v1.md)) |
| Avatar / current-user identity | Still mocked (`"Jordan Reyes"` / "JR", matching the design preview) — deliberately left out of this wiring pass | `Session.user` carries `{ id, accountId, role }` only; there is no display-name field to render. Wiring the avatar requires a backend change to the session payload (adding e.g. `fullName`), which is a separate, larger change than "wire the garage to `GET /vehicles`" — tracked as a Next step |
| Sort order | Sub-line text only ("Sorted by most recently logged"); the grid renders `GET /vehicles`'s response order as-is | Real "most recently logged" ordering requires Log Entry data, which doesn't exist yet (Log Entry is its own unimplemented V1 area). The label documents the intended V1 behaviour for when that data lands |

---

## Next steps (tracked follow-up — still V1 scope)

### Wire the avatar to real current-user data
The avatar still renders the mocked `"Jordan Reyes"` / "JR" (see Decisions — "Avatar / current-user identity"). `Session.user` only carries `{ id, accountId, role }`; doing this for real requires adding a display-name field (e.g. `fullName`) to the session payload — a backend change beyond this screen's scope.

### Build the Add Vehicle and Vehicle detail screens
This spec wires `/garage/add` and `/garage/[vehicleId]` as navigation targets (see Decisions — "Forward-linking to not-yet-built screens"); both are separate, already-tracked V1 milestone items ("Add vehicle screen", "Vehicle detail screen") requiring their own specs.

### Real "most recently logged" ordering
Once Log Entries exist, sort the Vehicle grid by each Vehicle's most recent Log Entry timestamp (falling back to creation date for Vehicles with none), matching the sub-line's stated behaviour.

---

## Out of scope

- Add Vehicle screen and Vehicle detail screen content (separate specs — tracked above and in [V1 milestone](../../milestones/v1.md))
- Search, filtering, and sort controls beyond the static "most recently logged" label
- Vehicle removal/archiving from the Garage (not a V1 concept)
- Organisational/multi-User Garages (V2 — see [`CONTEXT.md`](../../../CONTEXT.md) Account)
