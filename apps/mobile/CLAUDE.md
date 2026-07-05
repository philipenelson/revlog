# Mobile App — Architecture Rules

## Layered architecture (non-negotiable)

The mobile app uses the same MVVM layered architecture as the web app. Dependency direction is one-way and strictly enforced:

```
app/ → application/ → domain/ → infrastructure/
```

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

### `domain/` — repositories, types, validation

```
domain/
  repositories/              ← VehicleRepository, LogEntryRepository, OutboxRepository, etc.
  types.ts                   ← domain types
  validation/                ← client-side draft validation rules
```

Repositories are the ONLY place that touches the `LocalDatabase` port. ViewModels call repositories, never `LocalDatabase` directly. Repositories own the logic of "write to SQLite + enqueue outbox entry in a single transaction."

Services from `packages/api-client` are not called from viewmodels **for syncable application data** (vehicles, log entries) — that data goes through repositories so reads and writes stay offline-first. **Online-only operations that are never persisted locally (auth, report tokens) may call api-client services directly with `tokenHttpClient`, mirroring the web viewmodels** — see `useLoginViewModel` and `useRegisterViewModel`.

### `infrastructure/` — adapters, transport, sync, storage

```
infrastructure/
  database/
    LocalDatabase.ts          ← Port (interface)
    SQLiteLocalDatabase.ts    ← Adapter (expo-sqlite + Drizzle + SQLCipher)
  http/
    TokenHttpClient.ts        ← HttpClient adapter (reads from expo-secure-store)
  sync/
    SyncService.ts            ← Outbox flush + API pull
  storage/
    secureStorage.ts          ← expo-secure-store wrapper
```

`infrastructure/` imports nothing from `application/` or `domain/`. It satisfies ports defined in `domain/`.

---

## Offline-first rules (non-negotiable)

The app is fully offline-first. These rules govern *syncable application data* (vehicles, log entries) — the entities the user must be able to read and mutate offline. Online-only operations that are never persisted locally (auth, report tokens) are outside their scope and call api-client services directly, as the web does. For syncable data the rules apply without exception:

1. **All reads come from local SQLite.** ViewModels never call the API to display data. They call repositories, which read from `SQLiteLocalDatabase`.

2. **All writes go to SQLite + outbox in a single transaction.** Repositories call `LocalDatabase.transaction()` to apply the entity change and enqueue an outbox entry atomically. If the transaction fails, neither change is committed.

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

### Humble object pattern

Screen components are logic-free and are not unit-tested. Unit tests cover viewmodels, repositories, and services only.

- **ViewModels** — unit test all state transitions, effect logic, and validation paths
- **Repositories** — unit test with a mock `LocalDatabase`; verify write + outbox enqueue in same transaction
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

Always use `expo-secure-store` via `infrastructure/storage/secureStorage.ts` for auth tokens. Never store tokens in `AsyncStorage`, `MMKV`, or module-level variables that survive re-renders.

The `TokenHttpClient` reads tokens from secure storage and injects `Authorization: Bearer <accessToken>` on authenticated requests. On the refresh call (`POST /auth/refresh`) it injects `Refresh-Token: <refreshToken>` instead; on logout (`POST /auth/logout`) it injects *both* (Bearer to authenticate, Refresh-Token so the server can revoke it — ADR 0034). This is the only client-side auth mechanism.

---

## Bundle identifier

- **iOS:** `dev.revlog`
- **Android:** `dev.revlog`
- **Domain:** `revlog.dev`
