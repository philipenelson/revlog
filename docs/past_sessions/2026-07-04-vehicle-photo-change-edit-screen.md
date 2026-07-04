# Session: Change vehicle photo from the Edit Vehicle screen (web + mobile)

**Date:** 2026-07-04
**Branch:** `main` (in-place — no worktree for this session)

---

## Goal

Add the ability to change a Vehicle's photo from the Edit Vehicle screen, on both web and mobile, with full parity. This was an explicitly deferred item on both platforms going in: the web spec (`docs/specs/garage/edit-vehicle.md`) had "Photo edit/replace on the edit screen" as an Out of scope (V2+) line, and the mobile spec (`docs/specs/mobile-app/vehicle.md`) had "Editing an existing Vehicle's photo (from Edit Vehicle or Vehicle Detail) → Add Vehicle only for now; needs its own step." This session is that step, scoped specifically to Edit Vehicle (not Vehicle Detail, which remains deferred on both platforms).

The API side (`POST /vehicles/:id/photo`, `VehicleService.setVehiclePhoto`, `PrismaVehicleRepository.setPhoto`) already existed and was already unit-tested — built earlier for a different flow but never wired up to any client. This session is entirely client-side: `packages/api-client`, `apps/web`, and `apps/mobile`.

---

## Key decisions

Documented in full in `docs/specs/garage/edit-vehicle.md` and `docs/specs/mobile-app/vehicle.md`'s Decisions tables, and ADR 0027's 2026-07-04 update. Summary:

| Decision | Choice | Reason |
|---|---|---|
| Photo upload is a second, sequential API call after the field save, on both platforms | Web: `PATCH` then `POST /vehicles/:id/photo`. Mobile: same two calls, inside one `UPDATE_VEHICLE` outbox handler | `PATCH /vehicles/:vehicleId` is JSON-only; the photo endpoint is multipart-only. No combined endpoint exists, and adding one for a single caller isn't justified |
| No "remove photo to none" affordance | The remove-selection control only discards a *pending* pick, reverting to the currently-saved photo or placeholder — never calls the API | There is no API endpoint to clear an existing photo; the ask was to *change* the photo, not remove it |
| Mobile bundles the photo into `UPDATE_VEHICLE`'s outbox payload, not a second entry type | Mirrors `CREATE_VEHICLE`'s existing mechanism exactly: `VehicleRepository.update()` gains an optional `photo` param, persists it via the same `persistVehiclePhoto()`, stores the stable local path in `photoUrl` immediately | Same reasoning ADR 0027 already used for create: no second entry type means no new "photo still pending" field to carry through `reconcile()` |
| Mobile's permanent-failure cleanup covers *either* call | A permanent (4xx) failure of the field `PATCH` or the photo `POST` deletes the local file and drops the whole entry | A `failed` outbox entry is never retried (no V1 retry-backoff), so if the `PATCH` itself is rejected, the photo will never be attempted either — keeping the file around would only orphan it |
| No Appium E2E for the picker interaction itself | Neither platform's photo picker (mobile: `expo-image-picker`; this only applies to mobile, web uses a plain file input which Cypress already drives) gets device-level E2E automation for the picker step | Pre-existing gap on mobile — Add Vehicle's identical photo picker was never covered either, since it hands off to the native OS photo library outside Appium's reach with no existing mock. Not introduced by this session |

---

## What was built

| Commit | SHA | Description |
|---|---|---|
| 1 | `c59c83f` | Docs first: UC-VEDIT-4 (web) and UC-MOB-VEH-6 (mobile) specs, ADR 0027's 2026-07-04 update |
| 2 | `0811961` | `packages/api-client`'s `setVehiclePhoto`/`setVehiclePhotoUri`; web Edit Vehicle's photo zone (viewmodel + screen + CSS module, reusing Add Vehicle's tokens); Cypress E2E — 26/26 passing including 7 new photo scenarios |
| 3 | `f9a5693` | Mobile `VehicleRepository.update()` gains an optional `photo` param; `outboxHandlers.ts`'s `UPDATE_VEHICLE` handler uploads it via `setVehiclePhotoUri` after the field `PATCH`, with cleanup on any terminal outcome |
| 4 | `a0f6529` | Mobile Edit Vehicle's photo section (viewmodel + screen), mirroring Add Vehicle's picker UX |
| 5 | _(this commit)_ | Docs: mark UC-VEDIT-4 / UC-MOB-VEH-6 implemented, out-of-scope note on Appium picker coverage, this session summary |

---

## Verification

- **Web — Cypress** (`pnpm exec cypress run --spec cypress/e2e/edit-vehicle.cy.ts`, against the already-running local dev server): 26/26 passing, including all 7 new photo-change scenarios (placeholder/current-photo display, pick/preview, discard-without-API-call, successful save+upload+navigate, no-photo-picked never calls the endpoint, upload failure after a successful field save keeps the Owner on the screen with an inline error).
- **Web — `tsc --noEmit`**: clean for the new code specifically. The run does surface pre-existing `TS2786 'Link' cannot be used as a JSX component` errors across many unrelated files (a repo-wide `@types/react` version mismatch predating this session) — confirmed unrelated by checking the error only touches lines this session didn't add, in files this session didn't touch.
- **Web — `eslint`**: clean on both changed files.
- **Mobile — Jest** (`pnpm --filter @maintenance-log/mobile test`, run as `npx jest` from `apps/mobile`): full suite — 16 suites, 136 tests, all passing. Includes new coverage for `VehicleRepository.update`'s photo path (persists locally, stable path in `photoUrl`, outbox payload, no-photo no-op), `outboxHandlers.ts`'s `UPDATE_VEHICLE` handler (upload after PATCH, cleanup on success/permanent-failure-of-either-call/retryable-failure), and `useEditVehicleViewModel`'s photo state (initial value from the loaded vehicle, pick, discard-reverts-to-saved, submit passes the photo through, no-photo submit passes `undefined`).
- **Mobile — `tsc --noEmit`**: clean.
- **Mobile — `eslint`**: not run — no `eslint` binary reachable in this environment, a pre-existing gap already flagged in prior mobile session summaries (e.g. 2026-07-04's Delete Vehicle session).
- **Not done — no Appium run**: no new Appium E2E was written for the photo-picker interaction (see Decisions/Out of scope above for why), so there's nothing to run against a simulator for this feature specifically. The existing `edit-vehicle.e2e.ts` suite (unrelated to photo) remains in its prior state — written and typechecking, not run live, per the 2026-07-04 Delete Vehicle session.

---

## Out of scope

- Removing an existing photo back to "none," on either platform — no API support for it; would need a new endpoint.
- Photo change on Vehicle Detail (as opposed to Edit Vehicle) — still deferred on both platforms, unchanged by this session.
- Appium E2E coverage of the native photo-picker interaction on mobile — pre-existing gap, not introduced here; see Decisions above.
- Camera capture — still library-picker-only on mobile, matching the web app's plain file input; unchanged by this session.
