# Mobile App — Architecture Rules

## Architecture — Hexagonal (Ports & Adapters) MVVM (non-negotiable)

The mobile app is **Hexagonal (Ports & Adapters)** — see [ADR 0041](../../docs/adr/0041-hexagonal-architecture-mobile.md), which renames the MVVM layering of [ADR 0023](../../docs/adr/0023-mobile-app-architecture.md) into hexagon vocabulary (its rules are unchanged), mirroring the API (ADR 0039) and web (ADR 0040). Dependency direction is one-way and inward (there is no `src/` folder; layers live directly under `apps/mobile/`, alias `@/*` → `./*`):

```
app → application → domain            (adapters implement the ports the core defines)
```

**Frontend hexagon roles** — the UI framework *is* the driving adapter, so (as on web) the application layer is React-Native-bound, named openly:
- **Driving adapters** — `app/` routes + the `application/screens/*` **views**; also the **`SyncProvider` trigger** (responds to mount/reconnect/foreground/network events).
- **Core** — `domain/` (framework-free: repositories, driven **ports**, locale/validation) + the `application/` **ViewModels** (orchestration, bound to React Native by design).
- **Driven adapters** — `adapters/{database,http,sync,storage,biometrics,logging}`: the only code touching SQLite, the network, secure storage, the file system, biometrics, or the console. The **`SyncService` engine is a driven adapter** (talks OUT via the `HttpClient` port); only its trigger is on the driving side.

### `app/` — expo-router routing shell

Files under `app/` satisfy expo-router's file-based routing conventions only. They contain no logic, no state, no hooks, and no JSX beyond delegating to an `application/screens/` component.

```tsx
// app/garage/index.tsx — correct
export default function GaragePage() {
  return <GarageScreen />;
}
```

A route file that imports `useState`, calls a service, or contains JSX beyond a single component render is wrong.

### `application/` — screens, viewmodels, components, providers, navigation

```
application/
  screens/<screen>/
    <Screen>.tsx             ← View: renders viewmodel output only
    use<Screen>ViewModel.ts  ← ViewModel: all state, effects, handlers
  components/                ← reusable presentational components
  providers/                 ← AuthProvider, SyncProvider
  navigation/                ← route helpers (routeForAuthState, etc.)
```

**Views are logic-free.** A screen component receives everything it renders from its viewmodel and only wires callbacks to elements. No `useEffect`, no repository calls, no fetching, no branching beyond render conditionals on viewmodel state.

**ViewModels own all behaviour.** All state machines, effects, validation calls, and repository calls live in `use<Screen>ViewModel`. ViewModels return data and callbacks — never JSX.

### `domain/` — framework-free core (ports, repositories, validation)

```
domain/
  ports/                     ← driven port interfaces: Store<T>, OutboxWriter<T>, PhotoStore
  repositories/              ← VehicleRepository, LogEntryRepository, OutboxRepository, etc.
  locale.ts                  ← domain types/constants
  validation/                ← client-side draft validation rules
```

Repositories are the ONLY place that touches the `Store<T>` / `OutboxWriter<T>` ports. ViewModels call repositories, never a store directly. Repositories own the logic of "write to SQLite + enqueue outbox entry in a single atomic write (`OutboxWriter<T>`)." Every driven port a repository needs is **defined in `domain/ports/`** and injected as a constructor argument (e.g. `createVehicleRepository(store, outboxWriter, photoStore)`); the concrete adapter is supplied by `DatabaseProvider`.

Services from `packages/api-client` are not called from viewmodels **for syncable application data** (vehicles, log entries) — that data goes through repositories so reads and writes stay offline-first. **Online-only operations that are never persisted locally (auth, report tokens) may call api-client services directly with `tokenHttpClient`, mirroring the web viewmodels** — see `useLoginViewModel` and `useRegisterViewModel`. There is **no mobile-local gateway port** wrapping api-client (ADR 0041 §4).

### `adapters/` — the driven side (transport, database, sync, storage)

```
adapters/
  database/
    Store.ts / OutboxWriter.ts  ← (ports now live in domain/ports/ — see above)
    SQLiteStore.ts              ← Adapter: createSQLiteStore / createOutboxWriter
                                   (expo-sqlite + Drizzle + SQLCipher)
    openDatabase.ts schema.ts migrations.ts
  http/
    TokenHttpClient.ts          ← implements the api-client HttpClient port (reads secure store)
  sync/
    SyncService.ts              ← driven sync engine: outbox flush + API pull
    outboxHandlers.ts
  storage/
    secureStorage.ts preferences.ts credentialStore.ts  ← concrete single-impl wrappers (no port)
    photoStorage.ts             ← implements the domain/ports/PhotoStore port
  biometrics/biometrics.ts  logging/logger.ts           ← concrete single-impl wrappers (no port)
```

`adapters/` imports nothing from `application/`; it may import `domain/` (implementing its ports — the allowed inward direction). Only `photoStorage` and `SQLiteStore` implement a `domain/ports/` interface. The other wrappers (`secureStorage`, `preferences`, `credentialStore`, `biometrics`, `logger`, the `tokenHttpClient` singleton) stay **concrete with no port** — single implementations that don't leak into `domain/`, so a port would be boilerplate without a seam (ADR 0041 §3).

---

## Offline-first rules (non-negotiable)

The app is fully offline-first. These rules govern *syncable application data* (vehicles, log entries) — the entities the user must be able to read and mutate offline. Online-only operations that are never persisted locally (auth, report tokens) are outside their scope and call api-client services directly, as the web does. For syncable data the rules apply without exception:

1. **All reads come from local SQLite.** ViewModels never call the API to display data. They call repositories, which read via the `Store<T>` port (adapter: `SQLiteStore`).

2. **All writes go to SQLite + outbox in a single transaction.** Repositories call `OutboxWriter<T>.save()/remove()` to apply the entity change and enqueue an outbox entry atomically in one transaction. If it fails, neither change is committed.

3. **SyncService owns all network I/O.** It flushes the outbox to the API and pulls fresh data. Nothing outside `SyncService` initiates API calls for data sync.

4. **Token HttpClient is not a local data access layer.** `TokenHttpClient` never reads or writes *syncable* application data (vehicles, log entries) — that always goes through repositories and the outbox. It is used by `SyncService` (sync), `AuthProvider` (token refresh), and viewmodels performing online-only operations that are never persisted locally (login, register, report tokens).

---

## Styling (non-negotiable)

Use `StyleSheet.create()` with values from `@maintenance-log/ui-tokens` only. Import `colors`, `spacing`, and `fontSize` from the tokens package. Never write raw hex codes, `rgb()`, or hardcoded pixel values for colours or spacing in `StyleSheet` objects.

```ts
// Correct
import { colors, spacing, fontSize } from '@maintenance-log/ui-tokens';

const styles = StyleSheet.create({
  container: { backgroundColor: colors.neutral[50], padding: spacing[4] },
  heading: { fontSize: fontSize['2xl'], color: colors.neutral[900] },
});

// Wrong — raw values
const styles = StyleSheet.create({
  container: { backgroundColor: '#f5f5f5', padding: 16 },
});
```

This is enforced by the pre-commit hook in `scripts/pre-commit`, which scans `apps/mobile/**/*.ts(x)` for raw hex patterns.

Never use the `style={{}}` prop inline in JSX. Use `StyleSheet.create()` exclusively.

---

## Testing (non-negotiable)

### ViewModels — Pure Functional Core + Framework Hook Shell (ADR 0043)

ViewModels follow the same pattern as web: extract validations, calculations, data transforms, and business rules into **stateless pure functions** at **module scope in the same `use<Screen>ViewModel.ts` file** (outside the hook body), exported for their test — *not* a separate `<screen>.logic.ts` file, which only splits the screen's code. Logic that is **shared across screens** moves to its own `domain/*` module (e.g. `domain/apiError.ts`, `domain/vehicleForm.ts`, `domain/logEntryForm.ts`). The hook stays a thin coordination shell binding them to React's lifecycle.

- **Pure logic** → unit-tested **directly** (a `*.logic.test.ts` importing the module-scope exports from the viewmodel file, or `domain/*.test.ts` for shared cores) — where exhaustive branch coverage lives.
- **Hook shell** → tested via the `renderViewModel` harness (`apps/mobile/test/renderViewModel.tsx`, `@testing-library/react-native`) for state transitions, effects, and handler orchestration — not the business rules.
- A viewmodel that is pure coordination (e.g. `welcome`, `enable-biometrics`) exports no pure functions — its hook-shell test is enough.

Screen components are logic-free and are not unit-tested.

- **Repositories** — unit test with fake `Store<T>` / `OutboxWriter<T>` / `PhotoStore` ports injected; verify write + outbox enqueue in same transaction
- **Services** (`packages/api-client`) — unit test with a mock `HttpClient`

### E2E tests (Appium)

Every screen requires an Appium E2E test covering:
- The primary happy path
- Error states introduced or modified

A feature is not done without a passing Appium E2E test.

### Run tests

```
pnpm --filter @maintenance-log/mobile test
```

---

## Token storage (non-negotiable)

Always use `expo-secure-store` via `adapters/storage/secureStorage.ts` for auth tokens. Never store tokens in `AsyncStorage`, `MMKV`, or module-level variables that survive re-renders.

The `TokenHttpClient` reads tokens from secure storage and injects `Authorization: Bearer <accessToken>` on authenticated requests. On the refresh call (`POST /auth/refresh`) it injects `Refresh-Token: <refreshToken>` instead; on logout (`POST /auth/logout`) it injects *both* (Bearer to authenticate, Refresh-Token so the server can revoke it — ADR 0034). This is the only client-side auth mechanism.

---

## Bundle identifier

- **iOS:** `dev.revlog`
- **Android:** `dev.revlog`
- **Domain:** `revlog.dev`
