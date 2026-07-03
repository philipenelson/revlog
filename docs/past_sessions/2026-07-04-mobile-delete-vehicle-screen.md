# Session: Mobile — Delete Vehicle (UC-MOB-VEH-4)

**Date:** 2026-07-04
**Branch:** `main` (in-place — no worktree for this session)

---

## Goal

Implement delete vehicle. Checked first whether the designs/docs already covered it before writing anything: web's delete vehicle (`docs/specs/garage/delete-vehicle.md`) was already fully implemented (API + web Edit Vehicle danger zone, per the 2026-06-30 session and the v1 milestone's `[X]`). Mobile's own spec (`docs/specs/mobile-app/vehicle.md`, UC-MOB-VEH-4) and design (`docs/designs/mobile/revlog-mobile-edit-vehicle.html`'s "with danger zone" / "delete confirmation" frames) were also already written and detailed enough to implement directly — mobile's own v1 milestone line and the spec's Decisions table (`SyncService.flushOutbox()` permanently fails any outbox entry type with no registered handler, which is why Edit Vehicle shipped without it) explained exactly why it had been deferred and what unblocks it. So this session was pure implementation: no new spec, ADR, or design needed, only dated updates once built.

---

## Key decisions

Documented in `docs/specs/mobile-app/vehicle.md`'s Decisions table:

| Decision | Choice | Reason |
|---|---|---|
| `OutboxWriter<T>` gets a `remove()` sibling to `save()` | `remove(id, outboxType, outboxPayload)` deletes the row and enqueues the outbox entry in one `db.transaction()` | A separate `Store<T>.remove()` + separate outbox enqueue wouldn't be atomic across a crash between the two calls — the same reasoning ADR 0027 already used for `save()`, applied to the delete path |
| Delete cleans up a not-yet-synced local photo file | `VehicleRepository.delete()` calls `deleteVehiclePhoto()` only when `photoUrl` is still a local `file://` reference; a reconciled remote CDN url is left alone | Not spec'd explicitly, but a real latent bug: deleting a Vehicle created offline with a picked photo, before its `CREATE_VEHICLE` outbox entry ever syncs, would otherwise orphan that file in local storage forever — nothing else would ever clean it up |
| Delete navigates via `router.dismissTo('/garage')`, not `back()`/`replace()` | Pops both Vehicle Detail and Edit Vehicle off the stack in one call | Edit sits two levels below Garage (Garage → Detail → Edit); `back()` only pops one level, and the `replace()` pattern Add/Edit Vehicle already use elsewhere leaves the deleted Vehicle's stale Detail screen reachable via a back navigation from the resulting Garage. `dismissTo()` (expo-router 57, already in this project per ADR 0031) is the primitive built for exactly this |
| `DELETE_VEHICLE` outbox handler reuses `deleteVehicle` from `@maintenance-log/api-client` as-is | No new API-client function | It already existed — the same function the web app's delete vehicle feature added; only the mobile-side outbox wiring was missing |
| A 404 from the API is treated the same as any other permanent (4xx) rejection — logged and dropped, not specially "success" | No special-casing in `outboxHandlers.ts`'s `DELETE_VEHICLE` case | The local delete has already reached its intended end state either way (Vehicle gone); a 404 here would only ever mean it's gone server-side too (e.g. another device got there first). Special-casing it would be the only outbox handler in this file to do so, for no behavioural difference |

---

## What was built

| Commit | SHA | Description |
|---|---|---|
| 1 | `7710524` | `OutboxWriter<T>.remove()` port + `createOutboxWriter()`'s SQLite implementation |
| 2 | `391ffa1` | `VehicleRepository.delete()` — cascades to Log Entries via the schema's existing `ON DELETE CASCADE` FK, cleans up a not-yet-synced local photo file, enqueues `DELETE_VEHICLE` |
| 3 | `9a93793` | `outboxHandlers.ts`'s `DELETE_VEHICLE` case |
| 4 | `3b4fc42` | `useEditVehicleViewModel`'s delete-dialog state + `handleDelete` (`dismissTo('/garage')` on success); added the required `delete`/`remove` stubs to `SyncService.test.ts`'s fake repository |
| 5 | `cea3b46` | `EditVehicleScreen`'s danger zone + confirmation `Modal`, matching `revlog-mobile-edit-vehicle.html` |
| 6 | `53e814f` | Appium E2E spec: confirm-delete happy path (Garage shows its empty state afterward) and cancel path; added a testID on the dialog title's leaf `Text` (not the `Modal` container) per the iOS-text-aggregation gotcha found in a prior session |
| 7 | `ca74066` | Docs: checked off UC-MOB-VEH-4's acceptance criterion and the v1 milestone line; recorded the decisions above; marked "Edit Vehicle ships without the danger zone" as superseded rather than rewriting it; updated Out of scope |
| 8 | _(this commit)_ | This session summary |

---

## Verification

- **Jest** (`pnpm --filter @maintenance-log/mobile test`, run as `npx jest` from `apps/mobile`): 16 suites, 122 tests, all passing — including new coverage for `VehicleRepository.delete` (no-op when missing, atomic outbox enqueue, local-photo cleanup for both the local-file and remote-url cases), the `DELETE_VEHICLE` outbox handler (success, 5xx/network retryable, 4xx permanent), and `useEditVehicleViewModel`'s delete flow (open/close dialog, success + `dismissTo`, failure keeps the dialog open with an error, close-is-a-no-op while in flight).
- **`tsc --noEmit`**: clean for both the app (`apps/mobile`) and the E2E suite (`e2e/tsconfig.json`).
- **Not done — no live simulator available in this environment**: the new `edit-vehicle.e2e.ts` delete tests were not run against a real iOS/Android simulator + backend + Mailpit, unlike prior mobile sessions' live-verified features. They're written to the same conventions as the existing passing specs in that file and typecheck cleanly, but this is a real gap, not a formality — flagged in `vehicle.md`'s Status line and Out of scope rather than glossed over.
- **`eslint`**: not run — no `eslint` binary reachable in this environment (`pnpm --filter @maintenance-log/mobile lint` fails with `spawn ENOENT`), a pre-existing gap already flagged in prior mobile session summaries (e.g. 2026-07-03's Edit Vehicle session). `tsc --noEmit` used as the type-safety gate, as before.

---

## Out of scope

- Running the new Appium E2E delete tests against a live simulator (see Verification) — needs a follow-up pass with a simulator available.
- Anything on the web side — already shipped (2026-06-30 session), untouched here.
- Deleting a Vehicle that has a pending Transfer — per `docs/specs/garage/delete-vehicle.md`, the Edit Vehicle screen (mobile or web) is unreachable while a Transfer is pending, so this case can't occur through the UI; not given its own guard here, matching the existing web implementation.
