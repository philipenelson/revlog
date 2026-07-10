# Session: Hexagonal (Ports & Adapters) rearchitecture — Mobile

## Goal

Bring the mobile app under the same Hexagonal (Ports & Adapters) vocabulary as the API
(ADR 0039) and web (ADR 0040). Third and final app in the migration.

Like web, mobile was already **mostly hexagonal**: MVVM layers `app → application → domain →
infrastructure` (ADR 0023/0031), an offline-first core (SQLite `Store<T>` + outbox +
`SyncService`, ADRs 0026/0027), and the shared `HttpClient` port in `packages/api-client`
(ADR 0024, adapter `TokenHttpClient`). So this was a **surgical rename + move ports into the
core + close leaks**, not a reorg. (Mobile has no `src/` folder — layers live directly under
`apps/mobile/`, alias `@/*` → `./*`.)

## Key Decisions

- **Scope = surgical rename** (same premises as web). Rename `infrastructure/` → `adapters/`;
  move the driven ports into `domain/ports/`; views stay co-located; no gateway ports over
  `api-client` (viewmodels keep calling service functions directly with `tokenHttpClient` for
  online-only ops — the offline-first rule for syncable data is unchanged).
- **Ports into the core.** `Store<T>` and `OutboxWriter<T>` lived in `infrastructure/database/`
  next to their `SQLiteStore` adapter (the same "port next to adapter" web fixed for
  `MediaStore`). Moved both to `domain/ports/`. This also **resolved a doc-vs-code discrepancy**
  — `apps/mobile/CLAUDE.md` already claimed ports were "defined in `domain/`".
- **`PhotoStore` port for the one leaking storage util.** `domain/repositories/VehicleRepository`
  imported concrete `persistVehiclePhoto`/`deleteVehiclePhoto` (a runtime value import) — the
  one domain→infra edge. Introduced a `PhotoStore` port (`domain/ports/PhotoStore.ts`) and
  injected it, making all of `VehicleRepository`'s collaborators ports. **All other single-impl
  wrappers stay concrete** (`secureStorage`, `preferences`, `credentialStore`, `biometrics`,
  `logger`, the `tokenHttpClient` singleton) — none leak into `domain/`, so a port would be
  boilerplate (per the review guidance).
- **`SyncService` categorized, not moved.** The `SyncService` engine is a **driven adapter**
  (talks OUT via the `HttpClient` port); its trigger — `SyncProvider` (mount/reconnect/
  foreground/network events) — is a **driving adapter**. Named in ADR 0041; code stays in
  `adapters/sync/`.
- **Frontend hexagon named honestly** (as on web): the UI framework is the driving adapter, so
  ViewModels are React-Native-bound and not framework-free; only `domain/` is framework-free.

## What Was Built

- **ADR 0041** + rewritten `apps/mobile/CLAUDE.md` (hexagon vocabulary, `domain/ports/`, the
  storage-wrapper rule, SyncService categorization; also fixed stale `LocalDatabase`/
  `SQLiteLocalDatabase` naming) + light path-sync of the two mobile architecture specs
  (`overview.md`, `offline-sync.md`). Root `CLAUDE.md` needed no change. (`6317436`)
- **`Store`/`OutboxWriter` ports → `domain/ports/`** (git rename 100%); repoint the four
  repositories (+ tests) and the `SQLiteStore` adapter. (`0d31d6e`)
- **`PhotoStore` port** closes the photo leak: new port + `photoStorage` implements it +
  `createVehicleRepository(store, outboxWriter, photoStore)` + `DatabaseProvider` wiring + the
  3 photo viewmodels import `PickedPhoto` from the port + `VehicleRepository.test` injects a
  fake `PhotoStore`. (`2fddd31`)
- **`infrastructure/` → `adapters/`** rename: `git mv` (20 files, blame preserved) + rewrote
  every `@/infrastructure/*` → `@/adapters/*` across 31 files (incl. `jest.mock` strings).
  (`b5ef71f`)

## Verification

- `pnpm --filter @maintenance-log/mobile type-check` — **0 errors** at every step (baseline was
  also 0, unlike web; every step diffed identical/clean).
- `pnpm --filter @maintenance-log/mobile test` — **33 suites / 348 tests pass** at every step;
  none dropped by the moves.
- `git grep "@/infrastructure" apps/mobile` → nothing; `domain/` imports **zero** adapters
  (leak fully closed); nothing outside `apps/mobile` references its internals (rename is
  fully mobile-internal, so api/web/api-client are structurally untouched).
- Appium E2E (`apps/mobile/e2e/`, 19 specs) is the behaviour harness — no behaviour change
  intended; not run here (needs simulators). A Metro/Expo dev smoke would need
  `rm -rf apps/mobile/.expo apps/mobile/node_modules/.cache` first (RN caches file paths).

## Known gaps (pre-existing, not introduced here)

- **No runnable `eslint` for the mobile package** — it has no `eslint` devDependency, config,
  or binary; the `lint` script (`eslint .`) has never worked. Same gap the API package has.
  Type-check + Jest were the gates. (A separate task could add the eslint toolchain.)

## Out of Scope / Follow-ups

- Ports for the other single-impl storage/utility wrappers — deliberately kept concrete.
- Moving `SyncService` into an `application/` layer — kept in `adapters/sync/` (categorized).
- Adding the mobile eslint toolchain; the pre-existing duplicate-`@types/react` web build break.

## Migration complete

With this pass, all three apps are hexagonal: **API** (ADR 0039), **web** (ADR 0040),
**mobile** (ADR 0041).
