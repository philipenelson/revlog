# Mobile local database: expo-sqlite + Drizzle ORM + SQLCipher encryption

## Context

The mobile app is fully offline-first: all reads come from a local database on the device, and writes are applied locally before being queued for sync (see ADR 0027). The local database must:

- Store relational data (Accounts → Vehicles → Log Entries → Log Items)
- Encrypt data at rest so no other app can access it
- Work within the Expo managed workflow (no custom native build configuration)
- Be easy to abstract behind a port so the implementation can be replaced if needed

Several options were evaluated:

**WatermelonDB** — purpose-built offline-first ORM for React Native with built-in observables and a sync protocol. The sync protocol requires `pullChanges`/`pushChanges` API endpoints that the current API does not have, adding significant server-side scope. 38K weekly npm downloads (as of 2026). Does not fit the preference for lean, replaceable tools.

**Realm / Atlas Device SDK** — MongoDB's React Native database. Rebranded from Realm; sync now requires MongoDB Atlas (vendor lock-in). Heavy framework, not easily abstracted.

**expo-sqlite** — Expo's first-party SQLite library. 484K weekly npm downloads. Maintained by the Expo team. Since SDK 51: WAL mode, foreign key support, reactive change listeners, and SQLCipher encryption via the `key` option (no additional native build configuration in managed workflow). The `LocalDatabase` port means the specific adapter can be replaced without touching the domain or application layers.

**Drizzle ORM** — a TypeScript-first query builder. ~100KB, no code generation step, type-safe SQL, supports expo-sqlite. Explicitly not a heavy ORM framework — it generates SQL and stays out of the way. Easy to bypass for raw queries if needed.

## Decision

Use **expo-sqlite** for storage, **Drizzle ORM** for schema definition and type-safe queries, and **SQLCipher** (built into expo-sqlite's `key` option since SDK 51) for encryption at rest.

### Port / Adapter

```
infrastructure/database/
  LocalDatabase.ts          ← Port (TypeScript interface)
  SQLiteLocalDatabase.ts    ← Adapter (expo-sqlite + Drizzle)
```

`LocalDatabase` defines the low-level contract: open, execute, query, transaction. The domain layer never imports expo-sqlite directly.

### Repositories

Domain repositories in `domain/repositories/` sit above the `LocalDatabase` port and provide entity-level abstractions:

```
domain/repositories/
  VehicleRepository.ts
  LogEntryRepository.ts
  OutboxRepository.ts
  ...
```

ViewModels call repositories. Repositories call the `LocalDatabase` port. Nothing in the application or domain layer knows about SQLite, Drizzle, or expo-sqlite.

### Encryption

The database file is opened with a `key` derived from a per-install secret stored in `expo-secure-store`. SQLCipher applies 256-bit AES encryption to the database file on disk. No other app can read the database file even with direct file system access.

### Schema management

Drizzle handles schema definition and migration. Migrations run on app startup before any repository is accessed.

### Update (2026-07-02): port renamed `Store<T>`, not SQL-shaped, no cross-collection transaction

Gap found during the mobile Garage screen's implementation: this ADR named the port `LocalDatabase` with raw-SQL-shaped methods (`execute(sql, params)`, `query(sql, params)`, `transaction(fn)`, per `offline-sync.md`'s companion spec). Both the name and the shape promise more than the port needs to: "local" is a fact about the *adapter* (`SQLiteLocalDatabase`), not the capability the port offers, and "execute this SQL string" presupposes a SQL backend specifically — no in-memory, file, or non-SQL adapter could implement it without embedding or parsing SQL.

**Decision:** the port is `Store<T extends { id: string }>` (file: `infrastructure/database/Store.ts`, not `LocalDatabase.ts`): `getAll(options?: { where?: Partial<T>; orderBy?: { field: keyof T; direction: 'asc' | 'desc' } })`, `save(record)`, `remove(id)`, `replaceAll(records)`. Filter/sort criteria are generic, adapter-interpreted values, not literal SQL — `SQLiteStore` (renamed from `SQLiteLocalDatabase`, since "SQLite" already implies local/embedded, making "Local" redundant there too) turns them into a real Drizzle query; a hypothetical non-SQL adapter would filter/sort in code instead. `Store<T>` is instantiated once per entity/collection at construction time (`createSQLiteStore<VehicleSummary>(db, vehiclesTable)`), not a single shared instance taking a collection-name string per call — the string+generic-type pair would have no compiler-enforced correspondence. There is no generic `transaction(fn)` method on the port at all — see ADR 0027's own update (2026-07-02) for why a cross-collection combinator isn't the right tool here, and how the one real atomicity need this pattern has is met instead.

This doesn't change the underlying technology decision (expo-sqlite + Drizzle + SQLCipher), the repository layer above the port, the encryption approach, or the op-sqlite swap story below — only the port's name and method shape.

## Status

accepted

## Consequences

- All device data is encrypted at rest via SQLCipher; the encryption key is stored in the OS Keychain/Keystore.
- The `LocalDatabase` port means expo-sqlite can be swapped (e.g., for op-sqlite if performance becomes a concern) without changing any repository, viewmodel, or screen.
- Drizzle adds no runtime magic — generated queries are plain SQL, inspectable and debuggable.
- The Expo managed workflow is preserved; no native module configuration required.
- Repository interfaces are the testable seam: unit tests inject a mock `LocalDatabase`, so no SQLite dependency is required in the Jest test environment.

## V2+ items

- **op-sqlite** — a JSI-based SQLite library with synchronous reads and higher throughput. If the data model grows significantly (hundreds of vehicles, thousands of log entries per account), op-sqlite is a drop-in replacement via the `LocalDatabase` port.
- **Cloud media storage** — the `MediaStore` port (ADR 0019) will gain a `FileSystemMediaStore` adapter on mobile when media support lands in V2.
