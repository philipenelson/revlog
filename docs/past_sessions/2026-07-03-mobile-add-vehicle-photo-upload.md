# Session: Mobile — Add Vehicle photo upload

**Date:** 2026-07-03
**Branch:** `main` (in-place — no worktree for this session)

---

## Goal

Follow-on to the same day's Add Vehicle screen session (`2026-07-03-mobile-add-vehicle-screen.md`). That session shipped Add Vehicle with a static "Photo upload — V2" placeholder, read straight from a prior planning pass's spec/design deferral without confirming it was still wanted. It wasn't — the user caught this and asked for real photo upload, "like the web app version," and explicitly flagged that this kind of scope call should not be made solo. This session builds it, offline-durable, and fixes three real bugs live testing surfaced along the way.

---

## Key decisions

Documented in `docs/adr/0027-mobile-sync-outbox-pattern.md` (dated `### Update` sections, not rewrites) and `docs/specs/mobile-app/vehicle.md`'s Decisions table, before implementation — reversing the earlier "V2" deferral first, then designing the mechanism:

| Decision | Choice | Reason |
|---|---|---|
| Offline-durable, not online-required | User's explicit choice between two options (asked via AskUserQuestion, not decided solo) | The web app's photo upload is possible in one line because it's online-only; mobile's Add Vehicle already writes offline via the outbox. Matching "the web app" literally would mean requiring connectivity just for the photo, which the user didn't want |
| Photo bundled into the existing `CREATE_VEHICLE` outbox entry, not a second entry type | One handler does a plain create or a multipart create-with-photo depending on whether a photo reference is present | A second entry type needs its own local "pending" field and ordering guarantees; bundling gets an atomic vehicle+photo create (mirroring the web app's own single multipart request) for free |
| Client-generated Vehicle id extended to also key the local photo file | `persistVehiclePhoto()` copies the picked file into `${Paths.document}/vehicle-photos/<vehicleId>.<ext>` before the outbox entry is written | Survives the picker's own temp files being cleared and an app restart while the entry is still pending offline |
| No new local-only column for a "pending photo" | `VehicleRepository.create()` stores the stable local path directly in the existing `photoUrl` field instead of `null` | `Image` renders a `file://` uri exactly like a remote one; `reconcile()` already overwrites `photoUrl` with the server's real value once confirmed, since photo and vehicle sync atomically together — nothing to explicitly clear |
| `SyncProvider.runFullSync()` made single-flight | Mirrors `TokenHttpClient.refreshOnce()`'s existing pattern | Mount, reconnect, foreground, and pull-to-refresh had no coordination; harmless for idempotent creates/updates, but a photo's cleanup step (deleting the local file post-upload) made a concurrent duplicate run visibly fail |

---

## What was built

| Commit | SHA | Description |
|---|---|---|
| 1 | `9a5b960` | Spec + ADR update reversing the earlier V2 deferral, documenting the offline-durable mechanism before any code |
| 2 | `ba38788` | `expo-image-picker` + `expo-file-system` installed; library-only permission plugin in `app.config.ts` |
| 3 | `ce8fcb2` | `packages/api-client`: `createVehicleWithPhotoUri`, a React-Native-shaped sibling of the web-only `createVehicleWithPhoto` |
| 4 | `975e425` | `infrastructure/storage/photoStorage.ts` (`persistVehiclePhoto`, `deleteVehiclePhoto`) wrapping `expo-file-system`; `VehicleRepository.create()` accepts an optional photo |
| 5 | `c567e35` | `CREATE_VEHICLE` outbox handler uploads the photo when present, cleans up the local file on a terminal outcome |
| 6 | `bfad98d` | Real photo picker UI on `AddVehicleScreen`, replacing the static placeholder |
| 7 | `cf1b825` | **Bug fix**, found live: Expo SDK 57's `fetch` rejects the classic RN `{ uri, name, type }` FormData descriptor — needs a real `Blob`-like value. Fixed via a live `expo-file-system` `File` handle opened right before upload |
| 8 | `81eb238` | **Bug fix**, found live: no reentrancy guard on `runFullSync()` let a concurrent sync delete the photo file mid-upload by a sibling call. Made single-flight |
| 9 | `87d0ad6` | **Bug fix**, found live: photo didn't show on Vehicle Detail immediately (superseded an earlier "acceptable gap" call); Garage never got Vehicle Detail's own `useFocusEffect` fix, so a newly-created Vehicle stayed invisible until an unrelated sync completed |

---

## Verification

- **Jest**: `pnpm --filter @maintenance-log/mobile test` — 110 tests across 16 suites, all passing after every commit in the sequence above.
- **Vitest**: `pnpm --filter @maintenance-log/api test` — 268 tests across 16 files, unaffected and passing throughout.
- **`tsc --noEmit`**: clean on `apps/mobile` and `packages/api-client` throughout.
- **Live on-device verification (iOS simulator, real API + Mailpit + Postgres, no mocks) — this is where all three bug fixes came from, not from unit tests:**
  - First live attempt crashed the app entirely: `expo run:ios` had built from a stale `ios/` native project that predated the `expo-image-picker` config-plugin change, so the built app had no `NSPhotoLibraryUsageDescription` in its `Info.plist` — iOS hard-crashes on any photo-library access without it. Fixed by running `expo prebuild --platform ios` explicitly before rebuilding.
  - Second live attempt (correct rebuild) surfaced the FormData bug (commit `cf1b825`).
  - Third live attempt (user's own manual test) surfaced the concurrent-sync file-deletion race (commit `81eb238`) and the missing local preview / Garage focus-refetch gaps (commit `87d0ad6`).
  - Final round, confirmed working by the user: photo picked → preview shows immediately in Add Vehicle → Save → photo visible on Vehicle Detail immediately → back to Garage shows the new Vehicle immediately, no manual refresh needed → background sync uploads the photo without error.

---

## Out of scope

- Editing an existing Vehicle's photo (Edit Vehicle, Vehicle Detail) — Add Vehicle only; needs its own step once those screens' photo affordances are designed.
- Camera capture on the photo picker — library picker only, matching the web app's plain file input.
- `VehicleRepository.reconcile()`'s pre-existing gap (documented, not fixed): a pull that lands before a Vehicle's own `CREATE_VEHICLE` entry has synced will remove that Vehicle locally, since `reconcile()` replaces the whole table with exactly what the server returns. Predates photo upload entirely; the single-flight fix narrows the window this bites in considerably but doesn't close it. Revisit as its own piece of work (e.g., `reconcile()` preserving rows with a still-pending create) if it resurfaces.
- General outbox retry-idempotency beyond the same-id-resubmitted case — see ADR 0027's "Known limitation" note from the earlier session.
