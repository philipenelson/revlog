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
