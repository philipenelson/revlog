# Session: Mobile — Edit Vehicle screen

**Date:** 2026-07-03
**Branch:** `main` (in-place — no worktree for this session)

---

## Goal

Implement the mobile Edit Vehicle screen (UC-MOB-VEH-3 in `docs/specs/mobile-app/vehicle.md`), the next unchecked screen after last session's Vehicle Detail. Unlike Vehicle Detail, this meant more than a screen: no offline *write* path existed yet for any entity — `VehicleRepository` only ever read, `SyncProvider` wired an empty `NO_HANDLERS` map, and `Store<T>` (the only write primitive) is deliberately scoped to one table, so nothing could atomically apply a local write and enqueue its outbox entry the way ADR 0027 requires. Building Edit Vehicle meant building that missing foundation first.

---

## Key decisions

Documented in `docs/adr/0027-mobile-sync-outbox-pattern.md` (a further dated `### Update`, not a rewrite) and `docs/specs/mobile-app/vehicle.md`'s Decisions table, before implementation:

| Decision | Choice | Reason |
|---|---|---|
| `OutboxWriter<T>` — a second, narrower port alongside `Store<T>` | `save(record, outboxType, outboxPayload)` upserts the entity row and inserts the outbox row inside one `db.transaction()`, implemented by `createOutboxWriter()` in `SQLiteStore.ts` | `Store<T>` is scoped to one table and deliberately SQL-agnostic; a sequential `store.save()` + `outboxRepository.enqueue()` isn't atomic and could lose a write on a crash between the two calls — exactly what the outbox pattern exists to prevent. Reuses the same synchronous `db.transaction()` primitive `replaceAll()` already uses |
| Edit Vehicle ships without the danger zone | Only UC-MOB-VEH-3 (pre-fill, validate, save) this pass | `revlog-mobile-edit-vehicle.html` designs a delete confirmation on the same screen, but that's UC-MOB-VEH-4 — its own use case with its own `DELETE_VEHICLE` outbox entry type, cascade semantics, and dialog. Shipping it now means enqueueing an entry type with no registered handler, which `SyncService.flushOutbox()` marks permanently `failed` |
| Plain string form state, not react-hook-form + `zodResolver` | Mirrors the web Edit Vehicle screen's `VehicleDraft` approach; validated on submit via `createVehicleSchema.safeParse()` | `createVehicleSchema`'s `nickname` field `.transform()`s `"" → null`, making the schema's input and output types diverge — awkward for RHF's single generic, which the mobile Register/Login screens never hit since their schemas have no transforms. Reusing the canonical schema (rather than hand-duplicating field rules) still satisfies "validation rules match the web spec" |
| `UPDATE_VEHICLE` outbox handler classifies errors itself | 4xx `ApiError` propagates as permanent (entry marked `failed`, reverted on next pull per the server-wins policy); 5xx/`TimeoutError`/raw network failures are wrapped in `RetryableOutboxError` | `TokenHttpClient` has no built-in retry (`apps/mobile`'s adapter comment: "not needed by any V1 mobile use case yet") — without this classification, a plain offline error would propagate as a bare `Error` and `flushOutbox()` would mark it `failed` **permanently**, silently dropping the Owner's edit the first time they save while offline |

---

## What was built

| Commit | SHA | Description |
|---|---|---|
| 1 | `3100f3c` | ADR 0027 amendment (`OutboxWriter<T>`) + `vehicle.md` Decisions/Out-of-scope updates, written before any code |
| 2 | `4e2462e` | `OutboxWriter<T>` port + `createOutboxWriter()` SQLite adapter; `VehicleRepository.update()`; `OutboxRepository.buildOutboxEntry()` extracted for reuse; `DatabaseProvider` wiring |
| 3 | `5118eac` | `infrastructure/sync/outboxHandlers.ts` (`UPDATE_VEHICLE` handler); replaces `SyncProvider`'s `NO_HANDLERS` placeholder |
| 4 | `3ed2833` | The screen itself: `useEditVehicleViewModel` + `EditVehicleScreen` (pre-fill, inline validation errors, save/cancel, loading + not-found states) |
| 5 | `defd00d` | Appium E2E spec (`edit-vehicle.e2e.ts`): happy path, cancel, validation error; registered in `wdio.shared.conf.ts`; updated `vehicle-detail.e2e.ts`'s stale placeholder assertion; added a `vehicle-detail-sub` testID so the new spec can observe make/model/year/mileage round-tripping |
| 6 | `ddd3f9b` | Live E2E investigation (see Verification) — applied the two best-evidenced mitigations found; final confirmation still not green |
| 7 | _(this commit)_ | Spec close-out + this session summary |

---

## Verification

- **Jest**: `pnpm --filter @maintenance-log/mobile test` — 79 tests across 14 suites, all passing. New/changed coverage: `VehicleRepository.update()` (merges fields, enqueues atomically via `OutboxWriter`, no-ops for an unknown vehicle), `outboxHandlers` (payload shape, retryable vs. permanent error classification), `useEditVehicleViewModel` (pre-fill, validation, field-error clearing, save, comma-stripped mileage, local-write failure, cancel/back navigation).
- **`tsc --noEmit`**: clean, both the app (`apps/mobile`) and the E2E suite (`e2e/tsconfig.json`).
- **Live on-device verification (iOS simulator, real API + Mailpit + Postgres, no mocks) — inconclusive, documented in detail below rather than left unexplained:**

  A live run of `edit-vehicle.e2e.ts` found that taps on the header's Save/Cancel `Pressable`s never registered — every test got past navigating from Garage → Vehicle Detail → Edit Vehicle (confirming the screen itself renders and reads correctly) but then hung waiting for the post-tap result. This was investigated across many live runs, each hypothesis tested against a real page-source dump rather than guessed:

  1. **Keyboard occlusion, ruled in initially** — `edit-vehicle-cancel-btn` reported `visible="false"` in WDA's accessibility snapshot. Plausible: Save/Cancel sit in the header, outside the form's `keyboardShouldPersistTaps` `ScrollView` (unlike Register/Login, whose submit button is a `ScrollView` child), so a naive theory is the keyboard's dismiss-tap-catcher was occluding them.
  2. **`browser.hideKeyboard()`** — failed outright: WDA has no dismiss strategy it recognizes for this custom RN keyboard-avoiding layout ("Did not know how to dismiss the keyboard").
  3. **Tap the target twice** (first tap absorbs dismissal, second lands) — no effect.
  4. **Blur via the keyboard's own Return key, then tap** — confirmed via a fresh dump that this genuinely dismissed the keyboard (no more keyboard elements in the tree) — but `edit-vehicle-cancel-btn` **still** reported `visible="false"`, identically, with no keyboard present at all. This ruled out the keyboard-occlusion theory entirely: it's a static property of the element, not a keyboard effect.
  5. **Coordinate-based `mobile: tap`** (bypasses the element-hittable check `.click()` respects, using the element's own reported on-screen center) — still no effect.
  6. **Device console capture** — streamed `xcrun simctl ... log stream` filtered to the app's process during a run; showed no JS-side error or exception around the tap, which points away from an app-code bug (the viewmodel's `onCancel`/`handleSubmit` are unit-tested and correct) and toward something in native touch delivery this session couldn't isolate further.

  A separate, once-observed flake (`garage-vehicle-card-...` not appearing within its 35s budget) was traced to a long-lived, stuck `xcodebuild build-for-testing` WebDriverAgent process left over from earlier in the session (killing it and retrying resolved that specific symptom) — the same class of environmental issue the prior Vehicle Detail session's summary also flagged on this machine, though it wasn't the cause of the tap issue above, which reproduced identically on a clean simulator with no stray processes.

  **Net result:** the fixes from steps 3–5 are kept in `edit-vehicle.e2e.ts` as the most defensible attempt, but the spec is not confirmed passing live. This is recorded here in detail specifically so a future session doesn't re-walk the same ruled-out paths — the next step should look at native touch delivery (WDA/XCUITest session state, simulator-level input injection) rather than more test-script changes.

---

## Out of scope

- Danger zone / Delete Vehicle (UC-MOB-VEH-4) on the Edit Vehicle screen — its own step, needs a `DELETE_VEHICLE` outbox handler and confirmation dialog (see `vehicle.md`'s Decisions).
- Add Vehicle (UC-MOB-VEH-2) — separate use case, still `[ ]`; will reuse the same `OutboxWriter<T>`/handler-classification shape once built.
- Resolving the live E2E tap-delivery issue on Edit Vehicle's header buttons — investigated in depth (see Verification) but not solved this session; flagged for a follow-up with lower-level tooling (WDA logs, a different Appium driver version, or restructuring the header buttons to live inside the `ScrollView` like Register/Login's submit button, which would sidestep the question entirely regardless of its actual cause).
- `apps/mobile`'s `lint` script has no `eslint` devDependency reachable in this environment — pre-existing gap (flagged in prior mobile session summaries); `tsc --noEmit` used as the type-safety gate throughout, as before.
