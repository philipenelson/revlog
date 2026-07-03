# Session: Mobile — Add Vehicle screen

**Date:** 2026-07-03
**Branch:** `main` (in-place — no worktree for this session)

---

## Goal

Implement the mobile Add Vehicle screen (UC-MOB-VEH-2 in `docs/specs/mobile-app/vehicle.md`), the last unchecked Vehicle screen besides Delete. Unlike Edit Vehicle (last session), which updates a row that already exists locally, Add Vehicle has to invent a Vehicle from nothing while offline — which meant closing a prerequisite ADR 0027 had explicitly flagged and deferred: `POST /vehicles` didn't accept a client-supplied `id`, so there was no way to write a real local row and navigate straight to its Detail screen before the create had ever reached the server.

---

## Key decisions

Documented in `docs/adr/0027-mobile-sync-outbox-pattern.md` (a further dated `### Update`, not a rewrite) and `docs/specs/mobile-app/vehicle.md`'s Decisions table, before implementation:

| Decision | Choice | Reason |
|---|---|---|
| `POST /vehicles` accepts a client-supplied `id` | `createVehicleSchema` gains an optional `id: z.uuid()`; `PrismaVehicleRepository.create()` uses `vehicle.upsert({ where: { id }, create: data, update: {} })` instead of a plain `create` whenever an `id` is supplied | Fulfils the exact prerequisite ADR 0027's 2026-07-02 update named for "whichever future work adds offline vehicle/log-entry creation" — this is that work. The upsert-with-no-op-update (not a plain create) is what makes the ADR's original "retrying with the same id is safe" promise actually hold: a retried `CREATE_VEHICLE` outbox entry resolves to the same row instead of a unique-constraint error |
| `VehicleRepository.create()` generates the id client-side (`Crypto.randomUUID()`) | New row + `CREATE_VEHICLE` outbox entry written in one `OutboxWriter<T>` transaction — same shape as Edit Vehicle's `update()`. New Vehicles sort ahead of existing ones locally (next sync's `reconcile()` re-derives order from the server anyway) | UC-MOB-VEH-2 requires navigating to the new Vehicle's Detail screen on save, entirely offline-capable — there's no server-assigned id to navigate to at that point |
| Add Vehicle's save handler uses `router.replace()`, not `push()`/`back()` | `router.replace(\`/garage/${id}\`)` puts Detail in place of Add Vehicle on the stack | Add Vehicle was reached by pushing from Garage; `replace()` means a single `back()` from Detail returns straight to Garage instead of landing on a stale, already-submitted form — the create-path analogue of Edit Vehicle's `back()`-not-`push()` fix from last session |
| Plain string form state, validated via `createVehicleSchema.safeParse()` on submit | Mirrors Edit Vehicle's `VehicleFormFields` approach exactly, including the comma-stripping mileage workaround | Same reasoning as last session: the schema's `nickname` transform makes RHF's single generic awkward; reusing the canonical schema keeps field rules identical to the API and web without a second hand-maintained copy |
| `nickname` field widened to accept `null`, not just `undefined` | Added `.nullable()` to `createVehicleSchema`'s `nickname` field | Found while wiring `CREATE_VEHICLE`'s payload: every mobile outbox payload types `nickname: string \| null` and always sends the key, so a blank nickname serializes as `"nickname": null` — which the schema was rejecting with a 400. This silently broke the single most common case (no nickname) for both the new `CREATE_VEHICLE` path and the already-shipped `UPDATE_VEHICLE` path, which had no test coverage for a cleared nickname either. Pure widening — `null`, `undefined`, and a real string all still collapse to the same output |
| Photo affordance is a static, non-interactive placeholder | Renders the same "Photo upload — V2" box the design file shows, no `Pressable`, no picker wiring | Matches this spec's pre-existing "Vehicle photo upload → V2" scope cut — nothing to wire up yet |

---

## What was built

| Commit | SHA | Description |
|---|---|---|
| 1 | `6e10e1b` | API: `POST /vehicles` accepts a client-supplied `id` (`createVehicleSchema`, `CreateVehicleData`/`IVehicleRepository`, `PrismaVehicleRepository.create()`'s upsert, Vitest coverage); ADR 0027 amendment |
| 2 | `e1e5f37` | `VehicleRepository.create()`: client-generated id, `sortOrder` placement, `CREATE_VEHICLE` outbox entry via `OutboxWriter<T>`; unit tests |
| 3 | `a76c79d` | `outboxHandlers.ts`'s `CREATE_VEHICLE` handler (classified retryable/permanent like `UPDATE_VEHICLE`'s); `packages/api-client`'s `CreateVehiclePayload` gains `id`; the `nickname`-nullable schema fix found while wiring this |
| 4 | `f670791` | The screen itself: `useAddVehicleViewModel` + `AddVehicleScreen` (fields, inline validation errors, static photo placeholder, save/cancel), replacing the `ScreenPlaceholder` stub |
| 5 | `2660244` | Appium E2E spec (`add-vehicle.e2e.ts`): happy path, cancel, validation error; registered in `wdio.shared.conf.ts`; fixed `garage.e2e.ts`'s two Add Vehicle navigation tests, which asserted on the now-removed `placeholder-add-vehicle` testID |
| 6 | _(this commit)_ | Spec/milestone updates + this session summary |

---

## Verification

- **Vitest** (`pnpm --filter @maintenance-log/api test`): 268 tests across 16 files, all passing — including new coverage for the client-supplied `id` (route + service) and the `nickname: null` regression tests for both POST and PATCH.
- **Jest** (`pnpm --filter @maintenance-log/mobile test`): 93 tests across 15 suites, all passing.
- **`tsc --noEmit`**: clean on `apps/api`, `apps/mobile`, and the E2E suite (`e2e/tsconfig.json`). `apps/web`'s pre-existing `Link`/`ReactNode` type errors (an environment/React-types version mismatch predating this session) were confirmed unrelated via `git stash`.
- **Live on-device verification (iOS simulator, real API + Mailpit + Postgres, no mocks):** all three `add-vehicle.e2e.ts` scenarios (happy path with full create → outbox → sync → Vehicle Detail round-trip, cancel, validation error) passed cleanly, both individually and in combination across multiple runs — confirming the new offline-create path actually works end-to-end, not just in mocked unit tests. Both updated `garage.e2e.ts` assertions (empty-state CTA and FAB navigating to the real Add Vehicle screen) also passed live.
  - Repeated back-to-back full-suite runs reproduced the same pre-existing "garage card slow to appear" first-sync flake documented in the last two mobile session summaries — but it moved between different tests across runs (sometimes the happy path, sometimes cancel, sometimes neither), which is what confirms it's environmental test-setup flakiness rather than a defect in this screen: every one of the three scenarios passed cleanly at least once, and no failure ever reproduced with a longer timeout.

---

## Out of scope

- Delete Vehicle (UC-MOB-VEH-4) — the last remaining Vehicle screen, needs a `DELETE_VEHICLE` outbox handler and confirmation dialog (see `vehicle.md`'s Decisions from last session).
- Vehicle photo upload on Add Vehicle → V2, per this spec's existing scope cut; the screen renders the designed placeholder but wires nothing up.
- General outbox retry-idempotency beyond the same-id-resubmitted case (e.g. classifying "this looks like the same request already landed" as its own retry category) — see ADR 0027's 2026-07-03 update's "Known limitation" note.
- The pre-existing, environmental "garage card slow to appear" E2E flake in test setup (login → first sync) — seen again this session, not caused by any code here, not chased further (consistent with prior session summaries' treatment of the same issue).
