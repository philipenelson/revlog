# Mobile Vehicle Screens Spec

**Area:** Mobile / Vehicle
**Status:** In progress — Vehicle Detail (UC-MOB-VEH-1, UC-MOB-VEH-5 read-only), Edit Vehicle (UC-MOB-VEH-3), and Add Vehicle incl. photo upload (UC-MOB-VEH-2) implemented, unit-tested, and E2E-verified live; Delete Vehicle (UC-MOB-VEH-4) implemented and unit-tested, its Appium E2E test written but not yet run against a live simulator; Change Vehicle Photo on Edit Vehicle (UC-MOB-VEH-6) implemented and unit-tested — no Appium coverage of the picker interaction itself, see Out of scope (see Decisions)
**Last updated:** 2026-07-04

---

## Overview

Vehicle screens on mobile cover: Vehicle Detail, Add Vehicle, Edit Vehicle, and Delete Vehicle. Core use cases mirror the web specs (`docs/specs/garage/vehicle-detail-screen.md`, `docs/specs/garage/edit-vehicle.md`, `docs/specs/garage/delete-vehicle.md`). This spec covers mobile-specific behaviour.

Mobile-specific differences:
- All reads come from local SQLite via `VehicleRepository`.
- Write operations (create, update, delete) apply to local SQLite and are queued in the outbox. The UI responds immediately; sync to the API happens in the background.
- Vehicle photos are displayed when available (fetched URL from API response cached locally). Photo upload is supported on Add Vehicle (UC-MOB-VEH-2) and Edit Vehicle (UC-MOB-VEH-6), both offline-durable: the picked photo is copied to stable local storage and its upload is queued in the same outbox as the Vehicle create/update, surviving an app kill/restart while offline (see this file's Decisions, ADR 0027's 2026-07-03 "offline-durable photo upload" update, and its 2026-07-04 update extending the same mechanism to Edit Vehicle).

Design files: [`revlog-mobile-vehicle-detail.html`](../../designs/mobile/revlog-mobile-vehicle-detail.html) · [`revlog-mobile-add-vehicle.html`](../../designs/mobile/revlog-mobile-add-vehicle.html) · [`revlog-mobile-edit-vehicle.html`](../../designs/mobile/revlog-mobile-edit-vehicle.html)

---

## Use Cases

### UC-MOB-VEH-1 — Owner views Vehicle Detail

**Actor:** Owner
**Precondition:** Owner is on the Garage screen; at least one Vehicle exists locally.
**Milestones:** [V1](../../milestones/v1.md)

1. Owner taps a Vehicle card.
2. App navigates to the Vehicle Detail screen.
3. Screen reads Vehicle data (identity, insurance, log entries) from local SQLite via `VehicleRepository` and `LogEntryRepository`.
4. Renders immediately from local data. Background sync may update the data if the device is online.

---

### UC-MOB-VEH-2 — Owner adds a Vehicle

**Actor:** Owner
**Precondition:** Owner is on the Garage screen; taps `[+]`.
**Milestones:** [V1](../../milestones/v1.md)

1. Owner fills in: make, model, year, nickname (optional), current mileage, photo (optional — picked from the device's photo library).
2. Taps `[Save]`.
3. App validates the form (same rules as web spec).
4. On valid: if a photo was picked, it is copied into stable local storage first. Writes new Vehicle to local SQLite; adds `CREATE_VEHICLE` outbox entry (payload includes the stable local photo reference, if any) in the same transaction. Navigates to the new Vehicle's Detail screen.
5. SyncService sends the outbox entry to the API when online — as a multipart create-with-photo request when a photo reference is present, matching the web app's `createVehicleWithPhoto`. The local photo file is deleted once its upload succeeds or is permanently rejected (kept for a retryable failure, so a later retry can still find it).

---

### UC-MOB-VEH-3 — Owner edits a Vehicle

**Actor:** Owner
**Precondition:** Owner is on Vehicle Detail; taps `[Edit]`.
**Milestones:** [V1](../../milestones/v1.md)

1. Edit Vehicle screen pre-fills with current Vehicle data from local SQLite.
2. Owner modifies fields and taps `[Save]`.
3. App validates and writes the update to local SQLite; adds `UPDATE_VEHICLE` outbox entry (payload includes a stable local photo reference if the Owner also changed the photo — see UC-MOB-VEH-6).
4. Navigates back to Vehicle Detail with updated data.

---

### UC-MOB-VEH-4 — Owner deletes a Vehicle

**Actor:** Owner
**Precondition:** Owner is on the Edit Vehicle screen.
**Milestones:** [V1](../../milestones/v1.md)

1. Owner taps `[Delete vehicle]` in the danger zone.
2. App shows confirmation dialog: "Delete [Vehicle name]? This will permanently delete the vehicle and all its log entries. This cannot be undone."
3. Owner confirms.
4. App deletes the Vehicle and all related records from local SQLite (cascade); adds `DELETE_VEHICLE` outbox entry.
5. Navigates back to the Garage. SyncService propagates the hard delete to the API.

---

### UC-MOB-VEH-5 — Owner views a Vehicle with a pending transfer

**Actor:** Owner
**Precondition:** A `TRANSFER_VEHICLE` outbox entry has been sent; API has a pending transfer for this Vehicle.
**Milestones:** [V1](../../milestones/v1.md)

1. Vehicle Detail screen shows the Vehicle as locked: "Transfer pending — awaiting [recipient email]'s response."
2. Add Log Entry and Share Report actions are disabled (Edit and Delete live on screens not yet built).
3. Owner can cancel the transfer (adds `CANCEL_TRANSFER` outbox entry; Vehicle unlocks locally) — **implemented on `docs/specs/mobile-app/vehicle-transfer.md`'s Initiate Transfer screen, not here**; see this file's Decisions for why.

---

### UC-MOB-VEH-6 — Owner changes an existing Vehicle's photo

**Actor:** Owner
**Precondition:** Owner is on the Edit Vehicle screen.
**Milestones:** [V1](../../milestones/v1.md)

1. The photo zone at the top of Edit Vehicle shows the Vehicle's current photo (`photoUrl`, whether a real CDN url or a not-yet-synced local `file://` reference) if one exists, otherwise the same empty "Add a photo" placeholder Add Vehicle uses.
2. Owner taps it and picks a replacement from the device's photo library (`expo-image-picker`, library only — no camera capture, same as Add Vehicle). The zone shows the new pick immediately, with a remove-selection control that discards the pending pick and reverts to the previous photo (or the placeholder) without touching local storage or the outbox.
3. Owner taps `[Save]`.
4. App copies the picked photo into stable local storage keyed by the Vehicle's id (`persistVehiclePhoto`, the same helper Add Vehicle uses); writes the field changes plus the stable photo reference to local SQLite and an `UPDATE_VEHICLE` outbox entry, atomically. The Vehicle's `photoUrl` updates to the new local path immediately, so Vehicle Detail and Garage show it before the entry has synced.
5. SyncService's `UPDATE_VEHICLE` handler `PATCH`es the field changes, then — since a photo reference is present — uploads it via `POST /vehicles/:vehicleId/photo`. The local file is deleted once the upload succeeds or is permanently rejected (kept for a retryable failure, so a later retry can still find it); if it's never attempted or comes up short, `photoUrl` still holds the local file until then.
6. The next successful `reconcile()` replaces the local `photoUrl` with the server's confirmed one, the same way Add Vehicle's photo already does.

---

## Acceptance Criteria

- [x] Vehicle Detail reads from local SQLite — renders without network
- [x] Add Vehicle writes to SQLite + outbox in one transaction; navigates to detail on success
- [x] Edit Vehicle pre-fills from SQLite; writes update to SQLite + outbox on save
- [x] Delete Vehicle shows confirmation dialog; cascade-deletes from SQLite + queues outbox entry
- [x] Transfer-pending Vehicle shows locked state; action buttons disabled
- [x] Vehicle photo URL is displayed when cached locally; placeholder shown when absent
- [x] Add Vehicle: a picked photo persists to local storage and uploads via the outbox, surviving an app kill/restart while offline
- [x] All form validation rules match the web spec (year range, required fields, mileage non-negative) — both Add and Edit Vehicle validate via the shared `createVehicleSchema`
- [x] Edit Vehicle: photo zone shows the current photo (or placeholder), lets the Owner pick a replacement, and discards a pending pick without calling the outbox
- [x] Edit Vehicle: a picked replacement photo persists to local storage keyed by the Vehicle's id and uploads via the same `UPDATE_VEHICLE` outbox entry as the field changes, surviving an app kill/restart while offline
- [x] Edit Vehicle: saving without picking a new photo never touches photo storage or adds a `photo` field to the outbox payload

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Writes via outbox | SQLite + outbox in one transaction | Guarantees consistency: UI update and sync intent are atomic |
| Vehicle photo upload on Add Vehicle | In scope for V1, offline-durable via the outbox (not deferred to V2 as an earlier planning pass had it — see this file's history) | The Owner picks a photo from their library (`expo-image-picker`); it's copied into stable local storage (`expo-file-system`, keyed by the Vehicle's client-generated id) before the `CREATE_VEHICLE` outbox entry is written, so the file survives an app kill even while offline. The entry's payload carries that local reference; `outboxHandlers.ts`'s `CREATE_VEHICLE` handler uploads it via a multipart create-with-photo call (`createVehicleWithPhotoUri`, the React-Native-shaped sibling of the web's `createVehicleWithPhoto`) when it runs, and deletes the local file once the upload succeeds or is permanently rejected. See ADR 0027's 2026-07-03 "offline-durable photo upload" update |
| Delete cascade | Local SQLite cascade + single `DELETE_VEHICLE` outbox entry | API hard-delete cascades server-side; single outbox entry is sufficient |
| Delete Vehicle ships (supersedes the "Edit Vehicle ships without the danger zone" deferral below — its blocker, a registered `DELETE_VEHICLE` outbox handler, now exists) | `VehicleRepository.delete()` + a `DELETE_VEHICLE` case in `outboxHandlers.ts`, both landed 2026-07-04 | The deferral's own reasoning (`SyncService.flushOutbox()` permanently fails any entry type with no registered handler) no longer applies once the handler exists — same resolution pattern as this file's other superseded rows |
| `OutboxWriter<T>` gets a `remove()` sibling to `save()` | `remove(id, outboxType, outboxPayload)` deletes the row and enqueues the outbox entry in one `db.transaction()`, mirroring `save()`'s shape | A separate `Store<T>.remove()` call plus a separate outbox enqueue wouldn't be atomic across a crash between the two — the same reasoning ADR 0027 already used for `save()`, applied to the delete path |
| Delete cleans up a not-yet-synced local photo file | `VehicleRepository.delete()` calls `deleteVehiclePhoto()` when the row's `photoUrl` is still a local `file://` reference (i.e. picked on Add Vehicle, not yet uploaded); a reconciled remote CDN url is left alone | Without this, deleting a Vehicle created offline with a photo, before its `CREATE_VEHICLE` outbox entry ever syncs, would permanently orphan that file in local storage — nothing else ever cleans it up |
| Delete navigates via `router.dismissTo('/garage')`, not `back()` or `replace()` | Pops both Vehicle Detail and this Edit screen off the stack in one call, landing on the already-existing Garage instance underneath | Edit Vehicle sits two levels below Garage (Garage → Detail → Edit); `back()` only pops one level, and `replace()` (the pattern Add/Edit Vehicle already use elsewhere in this file) only swaps the *current* screen, leaving the deleted Vehicle's stale Detail screen still reachable via a back navigation from the resulting Garage. `dismissTo()` (expo-router 57, see ADR 0031) is the primitive built for exactly this — pop-to-existing-route — case |
| Vehicle Detail: insurance not displayed | No insurance row/dialog on mobile Vehicle Detail in V1, unlike the web spec | `revlog-mobile-vehicle-detail.html` has no insurance affordance in either state; no mobile spec has designed insurance edit UX yet. `SyncService` fetches `insurance` per ADR 0027's 2026-07-03 update but discards it — nothing reads it. Revisit as its own spec when mobile insurance UX is designed, rather than bolting a web-parity row onto this screen |
| Vehicle Detail: transfer-pending is read-only | Detail shows the locked banner (UC-MOB-VEH-5 steps 1–2) but no `[Cancel transfer]` action | Cancelling requires an `INITIATE_TRANSFER`/`CANCEL_TRANSFER` outbox handler and `transferService` wiring that don't exist yet — `SyncService.flushOutbox()` marks any entry with no registered handler `failed` permanently (see SyncService.ts), so enqueueing `CANCEL_TRANSFER` before its handler exists would silently and permanently no-op the cancellation. That handler pairs naturally with `INITIATE_TRANSFER`, both squarely in `docs/specs/mobile-app/vehicle-transfer.md`'s scope, so the cancel affordance ships there instead |
| Vehicle Detail: no type filter / sort control | Service history always renders newest-first, no filter dropdown | Unlike the web spec, this file's Acceptance Criteria and the design file never called for one; keeps V1 scope matched to what's actually specified here |
| Vehicle Detail: stats sourced from per-vehicle API fetch, not client computation | `stats.totalSpent`/`stats.lastLoggedAt` come from `GET /vehicles/:vehicleId` and are cached locally, not summed from local Log Entries | Mirrors the web spec's "stats computed server-side" decision; avoids a second, possibly-divergent computation living in the mobile client. See ADR 0027's 2026-07-03 update |
| Edit Vehicle ships without the danger zone | This pass implements only UC-MOB-VEH-3 (pre-fill, validate, save). `revlog-mobile-edit-vehicle.html` designs a Danger zone / delete-vehicle confirmation on the same screen, but that's UC-MOB-VEH-4, a distinct use case with its own outbox entry type (`DELETE_VEHICLE`), cascade semantics, and confirmation dialog | Same reasoning as Vehicle Detail's cancel-transfer deferral: bolting delete onto this pass means shipping a `DELETE_VEHICLE` outbox entry with no registered handler, which `SyncService.flushOutbox()` would mark permanently `failed`. Delete ships as its own step once it has a handler |
| Edit Vehicle form validation reuses `createVehicleSchema` from `@maintenance-log/domain`, not a hand-duplicated draft validator | Form fields are plain strings (mirrors web's `VehicleDraft`, avoids react-hook-form's type friction with `createVehicleSchema`'s `nickname` transform); on submit, the draft is parsed with `createVehicleSchema.safeParse()` and Zod's `fieldErrors` become the inline error state | Keeps the exact same field rules as the API and the web form without a second, hand-maintained copy of the regex/range checks — matches this file's own acceptance criterion "form validation rules match the web spec" more faithfully than re-deriving them |
| Edit Vehicle write path: `OutboxWriter<T>`, not `Store<T>.save()` + `OutboxRepository.enqueue()` | `VehicleRepository.update()` writes the vehicle row and enqueues the `UPDATE_VEHICLE` outbox entry in one `db.transaction()` via a new `OutboxWriter<T>` port | `Store<T>` is scoped to one table; a sequential save-then-enqueue isn't atomic and could lose an edit on a crash between the two calls, which is exactly what this ADR's outbox pattern exists to prevent. See ADR 0027's 2026-07-03 update |
| Garage-stack header ownership: `headerShown: false` at the Stack level, not per-screen | `garage/_layout.tsx`'s `screenOptions` hides the native header for every route in the stack by default, rather than the previous pattern of a visible-by-default native header with `index`/`[vehicleId]/index` individually opting out | Found via manual testing, not E2E debugging: the old per-screen opt-out pattern left Edit Vehicle's route with a stray, visible-but-transparent native header on top of its own custom header, silently absorbing every tap on Save/Cancel. This was the actual cause of every symptom logged below and in the session summary's original (wrong) live-E2E investigation — see ADR 0028's 2026-07-03 update |
| Edit Vehicle's E2E spec: `router.back()`, not `router.push()`, for Cancel and post-save success | Both handlers in `useEditVehicleViewModel` return to Vehicle Detail via `router.back()`; `useVehicleDetailViewModel` re-reads local SQLite on every `useFocusEffect` (not just on mount) so it shows the just-saved edit without a remount | Found via manual testing: `push()`ing the same route Edit was reached from stacked a second Detail instance on top of Edit instead of returning to the original, so a single "Garage" back-link tap from that second instance landed on the sandwiched Edit screen, not Garage. `back()` fixes the stack; `useFocusEffect` is needed because native-stack doesn't remount a screen it reveals via `back()`, so a plain mount-effect would keep showing pre-edit data |
| Add Vehicle: `VehicleRepository.create()` generates the Vehicle's id client-side (`Crypto.randomUUID()`) rather than waiting for the server | The new local row, its `sortOrder` (placed ahead of existing rows — the next sync's `reconcile()` re-derives it from the server anyway), and the `CREATE_VEHICLE` outbox entry are all written in one `OutboxWriter<T>` transaction, matching Edit Vehicle's `update()` shape | UC-MOB-VEH-2 requires navigating straight to the new Vehicle's Detail screen on save, entirely offline-capable — there is no server-assigned id to navigate to yet at that point. Requires `POST /vehicles` to accept a client-supplied `id`, which it now does — see ADR 0027's 2026-07-03 "`POST /vehicles` accepts a client-supplied `id`" update for the full mechanism (including why the repository uses an upsert, not a plain create, to stay retry-safe) |
| Add Vehicle's save handler: `router.replace()`, not `router.push()` or `back()` | On success, `useAddVehicleViewModel` calls `router.replace(\`/garage/${id}\`)`, putting the new Vehicle's Detail screen in place of Add Vehicle on the stack | Add Vehicle was itself reached by pushing from Garage. `push()`ing Detail on top would leave Add Vehicle's already-submitted form sitting underneath it, reachable by a `back()` from Detail; `replace()` means a single `back()` from Detail returns straight to Garage, with no stale form in between — same reasoning as Edit Vehicle's `back()` choice above, applied to the create path |
| Add Vehicle's photo zone is interactive (supersedes an earlier pass that shipped it as a static placeholder — see this file's history) | Tapping it opens the device's photo library (`expo-image-picker`); once picked, shows the same local preview + remove-photo affordance as the web app's `photoZone`, adapted to `Image`/`Pressable` | The static placeholder in the prior pass had been read straight from this file's own "Vehicle photo upload → V2" cut and `revlog-mobile-add-vehicle.html`'s placeholder text, without confirming that deferral was still wanted — it wasn't; this row and the "Vehicle photo upload on Add Vehicle" row above replace that decision |
| No camera capture, library picker only | `expo-image-picker`'s `launchImageLibraryAsync`, not `launchCameraAsync` | Matches the web app's affordance exactly — a plain file input, not a camera-specific control — rather than adding a mobile-only capability beyond parity |
| Photo upload is bundled into the `CREATE_VEHICLE` outbox entry, not a second outbox entry type | The entry's payload carries an optional local photo reference; the same handler does a plain create or a multipart create-with-photo depending on whether it's present | A second entry type (e.g. `UPLOAD_VEHICLE_PHOTO`) would need its own local schema field to track "photo still pending" across `VehicleRepository.reconcile()`, plus ordering logic to guarantee it never runs before its Vehicle's own create succeeds. Bundling into one entry gets an equivalent atomic "vehicle + photo" create the web app already does in a single `POST /vehicles` multipart request, with none of that — the same reasoning ADR 0027 already used for the outbox flushing pending entries strictly in order made a second, ordering-dependent entry type unnecessary here |
| `createVehicleSchema`'s `nickname` field widened to accept `null`, not just `undefined` | Found while wiring `CREATE_VEHICLE`'s outbox payload: every mobile outbox payload (`CreateVehicleData`/`UpdateVehicleData`) types `nickname` as `string \| null` and always sends the key, so a blank nickname serializes as `"nickname": null` — which the schema rejected with a 400 before this fix, silently breaking the common no-nickname case for both Add and the already-shipped Edit Vehicle | See ADR 0027's 2026-07-03 "`POST /vehicles` accepts a client-supplied `id`" update for the full incident writeup. Pure widening (`null`, `undefined`, and a real string all still collapse to the same transformed output), so no web-side behaviour changes |
| A picked photo shows on Garage and Vehicle Detail immediately, before the create has synced (supersedes an earlier pass that deferred this — see this file's history) | `VehicleRepository.create()` stores the stable local file path directly in `photoUrl` instead of `null`; no separate "pending photo" field, no UI changes on either screen | Asked directly, the earlier pass's "the Add Vehicle screen's own preview already covers it" reasoning was wrong — the Owner expects to see it on the screen they land on next, not just the one they picked it on. See ADR 0027's 2026-07-03 "local photo preview" update for why reusing `photoUrl` (rather than a second local column) is safe here specifically |
| Garage re-reads local SQLite via `useFocusEffect`, not `useEffect` (mirrors Vehicle Detail's own identical fix) | `useGarageViewModel`'s fetch effect now re-runs on every focus, same `[vehicleRepository, lastSyncedAt]` dependency as before | Found via manual testing: a Vehicle created via Add Vehicle (`replace()` to its Detail screen, then `back()` to Garage) never appeared until some unrelated sync completed, because native-stack doesn't remount Garage on `back()` and its old mount-effect had already run. Garage was never given the same `useFocusEffect` fix Vehicle Detail got when this exact class of bug was first found — see ADR 0027's 2026-07-03 update |
| Edit Vehicle's photo change (UC-MOB-VEH-6) reuses Add Vehicle's exact mechanism: bundled into the same `UPDATE_VEHICLE` outbox entry, not a second entry type | `VehicleRepository.update()` gains an optional `photo` parameter mirroring `create()`'s; the outbox payload gains an optional `photo` field; `outboxHandlers.ts`'s `UPDATE_VEHICLE` handler uploads it via `setVehiclePhotoUri` after the field `PATCH` succeeds | Same reasoning as the "Photo upload is bundled into `CREATE_VEHICLE`" row above, applied to update: no second entry type means no new "photo still pending" local field to carry through `reconcile()`, and reusing `photoUrl` for the local preview (below) means there is nothing in between "fully local" and "fully confirmed" for `reconcile()` to get wrong here either. See ADR 0027's 2026-07-04 update |
| Edit Vehicle's photo upload is a second, sequential API call after the field `PATCH`, not bundled into one request | `PATCH /vehicles/:vehicleId` is JSON-only; `POST /vehicles/:vehicleId/photo` (already built and unit-tested for Add Vehicle's create-with-photo path) is the only endpoint that accepts the file. The handler awaits the `PATCH`, then — only if a photo reference is present — awaits the photo `POST` | Mirrors the web Edit Vehicle screen's identical two-request shape (see `docs/specs/garage/edit-vehicle.md`'s Decisions), for the same reason: no combined multipart-PATCH endpoint exists, and adding one for a single caller isn't justified |
| A permanent (4xx) failure of either the field `PATCH` or the photo `POST` deletes the local photo file and drops the whole `UPDATE_VEHICLE` entry | The handler's single `try/catch` wraps both calls; any permanent failure logs, deletes the local file (if present), and re-throws so `flushOutbox()` marks the entry `failed` | A `failed` entry is never retried (no V1 retry-backoff mechanism — see this ADR's V2+ items), so if the `PATCH` itself is rejected outright, nothing will ever attempt the photo upload either; keeping the file around after that point would only orphan it, the same reasoning `delete()`'s existing photo cleanup already established |
| No local "remove photo to none" affordance on Edit Vehicle, mirroring the web decision | The remove-selection control only discards a *pending, not-yet-saved* pick, reverting to the previously-shown photo (real or placeholder) — it never enqueues anything | There is no API endpoint to clear an existing photo back to null; the Owner asked for the ability to change the photo, not remove it — same scope line as `docs/specs/garage/edit-vehicle.md`'s Decisions |

---

## Out of scope

- Removing an existing Vehicle's photo back to "none", on either Add or Edit Vehicle → no API support for it; see Decisions above
- Camera capture on Add Vehicle's photo picker → library picker only, matching the web app's plain file input (see Decisions above)
- Vehicle makes/models/years reference dataset → tracked in web V1 milestone; same deferral applies to mobile
- Insurance display/edit on mobile Vehicle Detail → needs its own spec (see Decisions above)
- Cancel transfer action on mobile Vehicle Detail → ships with `docs/specs/mobile-app/vehicle-transfer.md`'s Initiate Transfer screen
- Type filter / sort control on mobile Service History → not specified for V1
- Appium E2E run against a live simulator for Delete Vehicle (UC-MOB-VEH-4) → the spec at `apps/mobile/e2e/specs/edit-vehicle.e2e.ts` is written and typechecks, but this pass didn't have a simulator available to run it against a live backend
- Appium E2E coverage of the photo-picker interaction itself (UC-MOB-VEH-2 and UC-MOB-VEH-6) → `expo-image-picker` hands off to the native OS photo library outside the app's own view hierarchy; no existing Appium helper or mock drives it, and none was added here. This is a pre-existing gap, not new to UC-MOB-VEH-6: Add Vehicle's photo upload (UC-MOB-VEH-2) shipped "E2E-verified live" without it too. Unit tests (`useEditVehicleViewModel.test.ts`, `VehicleRepository.test.ts`, `outboxHandlers.test.ts`) cover the picked-photo path with a mocked picker instead
