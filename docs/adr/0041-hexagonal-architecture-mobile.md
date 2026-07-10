# Hexagonal (Ports & Adapters) architecture for the mobile app

## Context

The mobile app's layering was shaped by MVVM (ADR 0023, re-scaffolded onto Expo SDK 57 by
ADR 0031) and an offline-first foundation (SQLite `Store<T>` + outbox + `SyncService`,
ADRs 0026/0027). This ADR brings the mobile app under the same **Hexagonal (Ports & Adapters)**
vocabulary already adopted for the API (ADR 0039) and web (ADR 0040), so all three apps name
the *direction of dependencies* (driving vs. driven, inside vs. outside) the same way.

Like web, the mobile app is already **mostly hexagonal in substance**, just not in name:

- **A one-way layered structure exists**: `app → application → domain → infrastructure`
  (ADR 0023), with viewmodels co-located per screen.
- **Driven ports already exist**: `Store<T>` and `OutboxWriter<T>` (ADRs 0026/0027) with a
  `SQLiteStore` adapter; the `HttpClient` port lives in `packages/api-client` (ADR 0024,
  mobile's adapter is `TokenHttpClient`).
- **The sync engine is already isolated** behind repository interfaces and the outbox pattern
  (ADR 0027); nothing outside `SyncService` initiates data-sync network I/O.

Three things kept it from being cleanly hexagonal in *name*:

1. **The driven side is called `infrastructure/`, not `adapters/`** — the one folder whose name
   doesn't declare which side of the boundary it sits on (the API and web both renamed it).
2. **Two driven ports live next to their adapter.** `Store<T>` (`infrastructure/database/
   Store.ts`) and `OutboxWriter<T>` (`infrastructure/database/OutboxWriter.ts`) are pure port
   interfaces consumed by `domain/repositories/*`, but they physically sit in `infrastructure/`
   beside their `SQLiteStore` adapter — the same "port next to adapter" arrangement ADR 0040 §2
   fixed on web for `MediaStore`. `apps/mobile/CLAUDE.md` *already stated* ports are "defined in
   `domain/`", so this is also a doc-vs-code discrepancy that moving the ports resolves.
3. **One runtime domain→infrastructure leak.** `domain/repositories/VehicleRepository.ts`
   imports the concrete `persistVehiclePhoto`/`deleteVehiclePhoto` functions (a runtime *value*
   import) from `@/infrastructure/storage/photoStorage`, while its sibling collaborators
   (`Store`, `OutboxWriter`) are injected ports. Photo storage is the one collaborator that
   wasn't behind a port.

This ADR covers the **mobile app only**. The API (ADR 0039) and web (ADR 0040) decisions are
unchanged; the mobile MVVM decisions (ADR 0023/0031) are renamed into hexagon vocabulary, not
reversed.

### Frontend hexagon — the same honest divergence as web (ADR 0040)

As on web, the UI framework (React Native / expo-router) *is* the driving adapter, so the
application layer — the ViewModels — are React hooks and are **not** framework-free. We name
this plainly rather than pretend the whole core is framework-free:

- **Driving adapters** = `app/` routes + the `application/screens/*` **views** (they drive the
  core on user interaction). The **`SyncProvider` trigger** is also a driving adapter — it
  responds to system events (mount, reconnect, foreground, network changes) and kicks the sync
  engine.
- **Core** = `domain/` (framework-free: repositories, ports, locale/validation) + the
  `application/` **ViewModels** (application/orchestration logic, bound to React Native by
  design).
- **Driven adapters** = `adapters/{database,http,sync,storage,biometrics,logging}` — everything
  that talks to SQLite, the network, secure storage, the file system, biometrics, or the
  console. The **`SyncService` engine itself is a driven adapter** (it talks OUT to the API via
  the `HttpClient` port); only its trigger is on the driving side.

## Decision

Reorganize `apps/mobile/` around the hexagon, changing names and port locations — **not**
behaviour. (Mobile has no `src/` folder; layers live directly under `apps/mobile/` and the
alias is `@/*` → `./*`.)

### 1. Rename `infrastructure/` → `adapters/`

The driven side becomes `adapters/`, matching the API and web. Its sub-adapters are unchanged
in content:

```
adapters/
  database/    SQLiteStore.ts (implements Store/OutboxWriter), openDatabase, schema, migrations
  http/        TokenHttpClient.ts (implements the api-client HttpClient port)
  sync/        SyncService.ts (driven engine), outboxHandlers.ts
  storage/     secureStorage, preferences, credentialStore, photoStorage
  biometrics/  biometrics.ts
  logging/     logger.ts
```

The alias is unchanged; only the folder name and the `@/infrastructure/*` → `@/adapters/*`
import paths change.

### 2. Ports live in the core: move `Store<T>` and `OutboxWriter<T>` to `domain/ports/`

The two driven port interfaces move from `infrastructure/database/` into `domain/ports/`; their
`SQLiteStore` adapter (`createSQLiteStore`/`createOutboxWriter`) stays in `adapters/database/`.
The repositories that consume them (`domain/repositories/*`) now import them from within the
core. This closes the type-level `domain → infrastructure` edge and makes the CLAUDE.md claim
("ports defined in `domain/`") true. The `HttpClient` port stays in `packages/api-client` — it
is a *cross-app* contract, not mobile-private, so it does not move.

### 3. Close the photo leak with a `PhotoStore` port

Introduce a `PhotoStore` port (`domain/ports/PhotoStore.ts`) with `persist(vehicleId, photo)`
and `remove(uri)`, plus the `PickedPhoto`/`StablePhoto` types (moved out of the adapter so the
core owns them). `adapters/storage/photoStorage.ts` keeps its functions and additionally exports
an object implementing `PhotoStore`. `createVehicleRepository(store, outboxWriter, photoStore)`
takes the port and calls `photoStore.persist/remove`; the repository no longer imports anything
from `adapters/`. `DatabaseProvider` injects the adapter, exactly as it already injects `Store`
and `OutboxWriter`. This makes **all** of `VehicleRepository`'s collaborators ports.

**We do not port the other local utility wrappers.** `secureStorage`, `preferences`,
`credentialStore`, `biometrics`, `logger`, and the `TokenHttpClient` singleton stay **concrete**
in `adapters/`, with no port interface. They are single-implementation wrappers that are only
consumed by other adapters and providers (adapter→core is the allowed inward direction) and do
**not** leak native dependencies into `domain/`. A port there would be boilerplate without a
seam — the same reasoning ADR 0039 §4 used for inbound ports. `PhotoStore` earns its port solely
because it is the one such wrapper a *domain* file depended on.

### 4. No mobile-local gateway ports over `api-client`

ViewModels keep calling `@maintenance-log/api-client` service functions **directly**, passing
`tokenHttpClient`, for online-only operations that are never persisted locally (auth, report
tokens) — the established convention (ADR 0024; mirrors web ADR 0040 §4). Those functions
already sit behind the `HttpClient` port and are shared with web. A second, mobile-local gateway
would be the inbound-port boilerplate ADR 0039 §4 rejected. (Syncable application data still goes
through repositories + the outbox, never a direct api-client call from a viewmodel — the
offline-first rule is unchanged.)

### 5. Views stay co-located with ViewModels

As on web, we do **not** pull the `application/screens/*` views into a physical `adapters/ui/`
folder. Screen cohesion (view + viewmodel + test in one folder) is worth more than folder-level
literalism. The driving/driven roles are documented; only the driven side is physically named
`adapters/`.

## Why not a full "views-as-adapters" split / gateway ports / relocating SyncService

- **Views-as-adapters** — moving views into `adapters/ui/` shatters screen co-location for a
  naming purity nobody benefits from. Rejected (as on web).
- **Gateway ports over api-client** — indirection without a substitution seam (§4).
- **Relocating `SyncService` into `application/`** — it is a driven engine (network I/O), not a
  viewmodel; it stays in `adapters/sync/` and is *categorized* (§Context), not moved. Re-layering
  it would be a behavioural-risk change outside this surgical pass.
- **Ports for the other storage wrappers** — see §3; boilerplate without a seam.

## Trade-offs

- One mostly-mechanical rename touching ~40 files' import paths (`@/infrastructure` →
  `@/adapters`, incl. `jest.mock(...)` strings). Mitigated by `git mv` (blame preserved) and an
  import-path-only rewrite.
- The core is **not** 100% framework-free — the ViewModels are React hooks. Intrinsic to a
  frontend hexagon, named openly (as on web). The genuinely framework-free part (`domain/`,
  now including all three driven ports) stays framework-free.
- `VehicleRepository` gains a third constructor argument (`photoStore`). A small, one-time
  wiring/test change that makes the repository fully port-driven.
- No behaviour changes, so the Jest suite + Appium E2E are the regression guard.

## Status

accepted

## Consequences

- New mobile features follow the hexagon: framework-free repositories/ports/validation in
  `domain/`, orchestration in `application/` ViewModels, and anything touching SQLite / network /
  secure storage / file system / biometrics only in `adapters/`.
- `domain/ports/` holds the mobile-private driven ports (`Store`, `OutboxWriter`, `PhotoStore`);
  `adapters/` is the only place importing expo-sqlite, expo-file-system, expo-secure-store, etc.
  The `HttpClient` port stays cross-app in `packages/api-client`.
- ADR 0026/0027's port/adapter split is preserved; only the port *location* changes (into the
  core), which also resolves the prior CLAUDE.md-vs-code discrepancy.
- The sync border is named: `SyncService` (driven engine) vs. `SyncProvider` (driving trigger).

## V2+ items

- If a second media/storage backend ever appears (e.g. `FileSystemMediaStore` per ADR 0026's
  V2 note), the `PhotoStore` port is already the seam for it.
- Ports for the other storage wrappers only if a real substitution need appears (not now).
