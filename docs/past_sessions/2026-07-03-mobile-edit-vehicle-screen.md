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
| Garage-stack header: `headerShown: false` at the Stack level, not per-screen (found in a same-day follow-up, see the correction at the top of Verification) | `garage/_layout.tsx`'s `screenOptions` hides the native header for every route by default | The old pattern (visible native header by default, `index`/`[vehicleId]/index` individually opting out) left Edit Vehicle with a stray native header on top of its own — this was the actual cause of the "taps don't register" investigation below, found by manual testing, not further E2E debugging. See ADR 0028's 2026-07-03 update |
| Edit Vehicle's Cancel/save-success use `router.back()`, not `router.push()` (same follow-up) | Both return to Vehicle Detail via `back()`; `useVehicleDetailViewModel` moved from `useEffect` to `useFocusEffect` | `push()`ing the same route Edit was reached from stacked a duplicate Detail screen instead of returning to the original, so Detail's own "Garage" back-link (`back()`) popped onto the sandwiched Edit screen instead of Garage — found via manual testing. `useFocusEffect` is needed because native-stack doesn't remount on `back()`, so Detail would otherwise keep showing pre-edit data |

---

## What was built

| Commit | SHA | Description |
|---|---|---|
| 1 | `3100f3c` | ADR 0027 amendment (`OutboxWriter<T>`) + `vehicle.md` Decisions/Out-of-scope updates, written before any code |
| 2 | `4e2462e` | `OutboxWriter<T>` port + `createOutboxWriter()` SQLite adapter; `VehicleRepository.update()`; `OutboxRepository.buildOutboxEntry()` extracted for reuse; `DatabaseProvider` wiring |
| 3 | `5118eac` | `infrastructure/sync/outboxHandlers.ts` (`UPDATE_VEHICLE` handler); replaces `SyncProvider`'s `NO_HANDLERS` placeholder |
| 4 | `3ed2833` | The screen itself: `useEditVehicleViewModel` + `EditVehicleScreen` (pre-fill, inline validation errors, save/cancel, loading + not-found states) |
| 5 | `defd00d` | Appium E2E spec (`edit-vehicle.e2e.ts`): happy path, cancel, validation error; registered in `wdio.shared.conf.ts`; updated `vehicle-detail.e2e.ts`'s stale placeholder assertion; added a `vehicle-detail-sub` testID so the new spec can observe make/model/year/mileage round-tripping |
| 6 | `ddd3f9b` | Live E2E investigation, first pass (see Verification's correction) — applied several evidence-based mitigations for the *wrong* root cause; final confirmation not green |
| 7 | `2dd6616` | Spec close-out + this session summary, first version — concluded (wrongly) that the tap issue was likely a native touch-delivery problem beyond this session's reach |
| 8 | `ddb7180` | **The actual fix, found by the user via manual testing**: `garage/_layout.tsx` now sets `headerShown: false` at the Stack level. A stray, visible native header on Edit Vehicle's route (every route except `index`/`[vehicleId]/index` inherited it) had been sitting on top of the screen's own custom header the whole time, absorbing every Save/Cancel tap — not a keyboard, tooling, or native-touch-delivery issue at all. Amends ADR 0028 |
| 9 | `0843bde` | Second bug, also found by manual testing: Edit Vehicle's Cancel/save-success used `router.push()` instead of `router.back()`, stacking a duplicate Vehicle Detail screen under Edit rather than returning to it — so Detail's "Garage" back-link landed on the sandwiched Edit screen after a save. Fixed with `back()` + a `useFocusEffect`-based refetch in `useVehicleDetailViewModel` so Detail still shows fresh data without a remount |
| 10 | `c516fe9` | `edit-vehicle.e2e.ts` simplified back to plain `.click()` now the real bug is fixed (the workarounds from commit 6 solved a symptom, not the cause); added a dedicated regression test for the Garage-button bug |
| 11 | _(this commit)_ | Corrects this summary's Verification section and `vehicle.md`'s Decisions to record the real root causes |

---

## Verification

**Correction to this session's original conclusion:** the first version of this document (commit 7) stated live E2E verification was inconclusive and "likely a native touch-delivery issue this session couldn't isolate further." That was wrong. In a same-day follow-up, the user found the actual cause by manual testing — not by further E2E debugging — and it was a plain, visible rendering bug: `garage/_layout.tsx`'s Stack only hid the native header on `index` and `[vehicleId]/index`; every other route, including Edit Vehicle, inherited a visible-but-transparent native header that sat on top of the screen's own custom header and silently absorbed every tap on Save/Cancel. Every symptom the original investigation logged is fully explained by this: the buttons reporting `visible="false"` in WDA's snapshot regardless of keyboard state (a competing header on top, not a keyboard-dismissal quirk), and a coordinate-based `mobile: tap` still landing on nothing (it hit the header, not the `Pressable` underneath). None of it was a native-touch-delivery mystery. The fix (`ddb7180`) sets `headerShown: false` at the Stack level so every route is covered by default.

A second, unrelated bug surfaced once the first was fixed and live E2E could actually exercise the full flow: after saving an edit, Vehicle Detail's "Garage" back-link navigated to Edit Vehicle instead of Garage. Cause: `useEditVehicleViewModel`'s Cancel and save-success handlers called `router.push(\`/garage/${vehicleId}\`)` — the same route Edit was reached from — which stacks a *second* Detail instance on top of Edit instead of returning to the first (`Garage → Detail(1) → Edit → Detail(2)`, Edit sandwiched in the middle). A single `back()` from Detail(2) popped exactly one level, landing on Edit. Fixed (`0843bde`) by using `back()` consistently, plus switching `useVehicleDetailViewModel`'s data-fetch from `useEffect` to `useFocusEffect` (native-stack reveals the same screen instance on `back()`, it doesn't remount it, so a plain mount-effect would keep showing pre-edit data forever).

- **Jest**: `pnpm --filter @maintenance-log/mobile test` — 79 tests across 14 suites, all passing throughout, including after both fixes above (mocks updated for `router.back()` and a `useFocusEffect`-as-`useEffect` stand-in).
- **`tsc --noEmit`**: clean throughout, both the app (`apps/mobile`) and the E2E suite (`e2e/tsconfig.json`).
- **Live on-device verification (iOS simulator, real API + Mailpit + Postgres, no mocks) — confirmed green after both fixes:**
  - `edit-vehicle.e2e.ts`: 4/4 passing (save, cancel, validation error, and the new Garage-button regression test) — confirmed both in a full clean run and with the Garage-button test additionally verified in isolation and via a page-source dump showing it reaches Garage within 3 seconds of the tap.
  - `vehicle-detail.e2e.ts`: 6/7 passing; the one failure was `garage-vehicle-card-...` not appearing within its 35s setup-phase budget — the same environmental flake already seen and documented multiple times this session (also flagged in the prior Vehicle Detail session's summary), not a regression. Every test that exercises the header-rendering fix directly (e.g. "the Edit icon navigates to Edit Vehicle") passed clean.
  - `garage.e2e.ts`: 3/3 passing.

---

## Out of scope

- Danger zone / Delete Vehicle (UC-MOB-VEH-4) on the Edit Vehicle screen — its own step, needs a `DELETE_VEHICLE` outbox handler and confirmation dialog (see `vehicle.md`'s Decisions).
- Add Vehicle (UC-MOB-VEH-2) — separate use case, still `[ ]`; will reuse the same `OutboxWriter<T>`/handler-classification shape once built.
- A pre-existing, environmental "garage card slow to appear" E2E flake in test setup (login → first sync), seen intermittently across this and prior sessions on this machine — not caused by any code in this session, not chased further.
- `apps/mobile`'s `lint` script has no `eslint` devDependency reachable in this environment — pre-existing gap (flagged in prior mobile session summaries); `tsc --noEmit` used as the type-safety gate throughout, as before.
