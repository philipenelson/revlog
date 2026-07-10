# Mobile Offline Sync Spec

**Area:** Mobile / Infrastructure
**Status:** Partially implemented — LocalDatabase/SQLCipher, VehicleRepository, OutboxRepository, single-collection pull, and outbox flush dispatch all built (alongside the Garage screen); LogEntryRepository, AccountRepository, multi-collection reconcile, and real outbox handlers are not
**Last updated:** 2026-07-02

---

## Overview

The mobile app is fully offline-first. All reads come from a local SQLite database on the device. All writes are applied locally and queued for sync. A `SyncService` flushes the outbox and pulls server data when online. Data is encrypted at rest via SQLCipher.

This spec covers the offline/sync infrastructure. See ADR 0026 (database) and ADR 0027 (outbox pattern) for architectural decisions.

Design file: [`revlog-mobile-offline-sync.html`](../../designs/mobile/revlog-mobile-offline-sync.html)

---

## Components

**Corrected during implementation (2026-07-02) — see ADR 0026's and ADR 0027's dated "Update" sections for the full reasoning:** the port below is `Store<T>`, not `LocalDatabase` with raw SQL methods, and `SyncService`'s outbox dispatch below is generic (a `RetryableOutboxError` marker), not an HTTP-status-aware engine. This section reflects what was actually built.

### `Store<T>` port

```ts
// domain/ports/Store.ts  (moved into the core — ADR 0041)
export interface Store<T extends { id: string }> {
  getAll(options?: { where?: Partial<T>; orderBy?: { field: keyof T; direction: 'asc' | 'desc' } }): Promise<T[]>;
  save(record: T): Promise<void>;
  remove(id: string): Promise<void>;
  replaceAll(records: T[]): Promise<void>;
}
```

`SQLiteStore` (`adapters/database/SQLiteStore.ts`, factory `createSQLiteStore<T>(db, table)`) implements this port using expo-sqlite + Drizzle, one instance per entity/collection. `openDatabase.ts` opens the connection, sets the SQLCipher key (a `PRAGMA key` statement, not an open option — see ADR 0026's update), and runs migrations once; the key is generated via `expo-crypto` and stored in `expo-secure-store` (`secureStorage.getOrCreateDbKey()`, deliberately untouched by the per-restart token clear).

### Repositories

Domain repositories in `domain/repositories/` provide entity-level abstractions over `Store<T>`:

- [x] `VehicleRepository` — `findAll()`, `reconcile()` (built)
- [ ] `LogEntryRepository` — CRUD for Log Entries and Log Items (not built — no screen needs it yet)
- [x] `OutboxRepository` — enqueue, list pending, mark status, delete (built, unexercised — nothing enqueues yet)
- [ ] `AccountRepository` — cache account/user data (not built)

ViewModels call repositories. Repositories call `Store<T>`. Nothing in `application/` touches the database or sync layer directly.

### Outbox table

```sql
CREATE TABLE outbox (
  id         TEXT PRIMARY KEY,       -- UUID; doubles as idempotency key
  type       TEXT NOT NULL,          -- 'CREATE_VEHICLE' | 'UPDATE_VEHICLE' |
                                     -- 'DELETE_VEHICLE' | 'CREATE_LOG_ENTRY' |
                                     -- 'UPDATE_LOG_ENTRY' | 'DELETE_LOG_ENTRY' |
                                     -- 'INITIATE_TRANSFER' | 'CANCEL_TRANSFER' |
                                     -- 'INITIATE_REPORT_TOKEN' | 'REVOKE_REPORT_TOKEN'
  payload    TEXT NOT NULL,          -- JSON string of the mutation data
  created_at INTEGER NOT NULL,       -- Unix timestamp ms
  status     TEXT NOT NULL           -- 'pending' | 'processing' | 'failed'
               DEFAULT 'pending'
);
CREATE UNIQUE INDEX outbox_id ON outbox(id);
```

Every write operation in a repository calls `OutboxRepository.enqueue()` in the same `LocalDatabase.transaction()` call. If either the entity write or the outbox write fails, the transaction rolls back — the UI never shows a change that is not also in the outbox.

### SyncService

`adapters/sync/SyncService.ts` — factory `createSyncService({ client, vehicleRepository, outboxRepository, handlers })`, mounted (via `SyncProvider`) at the application root.

**Outbox flush (`flushOutbox()`, triggered on mount, connectivity restored, and app foreground):**

1. Fetch all `pending` outbox entries ordered by `created_at`.
2. For each entry:
   a. Mark `processing`.
   b. Look up `handlers[entry.type]` — a registry injected by whoever mounts `SyncService`, not built into it. No handler registered: mark `failed`, log, continue. *No handlers are registered yet* (`SyncProvider` passes `{}`) — nothing enqueues outbox entries in this pass, so this is currently every entry's fate; real handlers (`CREATE_VEHICLE`, etc.) are Add Vehicle's responsibility.
   c. Handler throws `RetryableOutboxError` (a marker class `SyncService` defines and owns): revert to `pending`, stop the whole flush — this is what happens for a 5xx/network/timeout, once a real handler classifies its own failure that way. `SyncService` itself never imports `ApiError` or inspects HTTP status codes — that classification belongs at the handler boundary, where HTTP actually happens (see ADR 0026's 2026-07-02 update for the parallel reasoning applied to `Store<T>`).
   d. Handler throws anything else: mark `failed`, log, continue (a permanent failure, e.g. a 4xx validation error, once a real handler exists).
   e. Handler succeeds: delete the outbox entry.
3. On completion: trigger a pull.

**Pull (`pull()`, triggered after outbox flush, on pull-to-refresh, and on app foreground):** Single collection only in this pass — `GET /vehicles` reconciles the Vehicle list in local SQLite (`VehicleRepository.reconcile()`, an atomic `replaceAll`). The phased parent-then-child sequencing for when Log Entries join the pull (reconcile Vehicles to completion, then Log Entries scoped from the *freshly reconciled* Vehicle set) plus `PRAGMA foreign_keys = ON` / `ON DELETE CASCADE` for orphan cleanup is documented in ADR 0027's 2026-07-02 update, not implemented here — no `LogEntryRepository` exists yet. Idempotency-Key headers and `GET /auth/me` account-data caching also don't exist yet — no real handler calls the API yet, and no `AccountRepository` exists.

**Conflict resolution:** Server wins — unchanged from the original decision. `OutboxRepository.listFailed()` doesn't exist yet (no failed-entry surfacing UI needed until real handlers produce failures); `listPending()`'s count is what's currently surfaced.

### SyncProvider

`application/providers/SyncProvider.tsx` mounts `SyncService` and exposes via context — a flatter shape than originally sketched, since `failedCount` has no consumer yet:

- `isOnline: boolean`
- `pendingCount: number`
- `syncStatus: 'idle' | 'syncing' | 'error'`
- `lastSyncedAt: Date | null`
- `refresh(): Promise<void>` — trigger an explicit pull-to-refresh (or full sync, on mount/foreground/reconnect)

Only runs when `DatabaseProvider`'s repositories are ready and `AuthProvider`'s session exists — never while unauthenticated or before the local database has opened.

---

## Use Cases

### UC-MOB-SYNC-1 — Owner creates a log entry while offline; entry syncs on reconnect

**Actor:** Owner
**Precondition:** Device has no connectivity.
**Milestones:** [V1](../../milestones/v1.md)

1. Owner fills in and saves a new log entry.
2. `LogEntryRepository.create()` writes the entry to local SQLite and enqueues `CREATE_LOG_ENTRY` in the outbox — in a single transaction.
3. Vehicle Detail screen shows the new entry immediately.
4. Offline indicator shows pending sync.
5. Device reconnects. `SyncService` flushes the outbox: sends the `CREATE_LOG_ENTRY` entry to `POST /vehicles/:vehicleId/log` with idempotency key.
6. On success: outbox entry deleted. Offline indicator clears.

---

### UC-MOB-SYNC-2 — Owner views Garage while offline

**Actor:** Owner
**Precondition:** Device has no connectivity; local SQLite has been seeded by a prior sync.
**Milestones:** [V1](../../milestones/v1.md)

1. Garage screen reads Vehicles from local SQLite. Renders immediately.
2. Offline indicator appears in header.
3. Owner can navigate to Vehicle Detail and Log Entries — all reads are local.
4. Writes (new log entry, edit vehicle) work as normal — queued in outbox.

---

### UC-MOB-SYNC-3 — Outbox flushes on reconnect

**Actor:** System
**Precondition:** Device was offline; one or more outbox entries are pending; device reconnects.
**Milestones:** [V1](../../milestones/v1.md)

1. `@react-native-community/netinfo` emits a connected state change.
2. `SyncService` detects the change and begins outbox flush.
3. Pending entries are sent to the API in `created_at` order.
4. On all entries sent successfully: pull is triggered. Offline indicator clears.

---

### UC-MOB-SYNC-4 — Server rejects a mutation (conflict)

**Actor:** System
**Precondition:** An outbox entry references a resource that was deleted server-side (e.g., Vehicle deleted via web app while mobile was offline).
**Milestones:** [V1](../../milestones/v1.md)

1. `SyncService` sends the mutation. API returns 404.
2. Outbox entry is marked `failed`.
3. `SyncService` continues flushing remaining entries.
4. Pull reconcile runs: the deleted resource is removed from local SQLite.
5. Failed outbox entry remains in `failed` state. `SyncProvider` exposes `failedCount > 0` for future surface.

---

## Acceptance Criteria

### Encryption
- [x] Local SQLite database file is encrypted with SQLCipher; encryption key is stored in expo-secure-store — verified on-device (Step 2 smoke test: writes/reads only succeed after the `PRAGMA key` statement runs)
- [ ] The database file cannot be read by another app or via the device file system — not independently verified (would need a raw file-system read attempt outside the app sandbox); reasonable to assume true given standard iOS sandboxing + SQLCipher, but not empirically confirmed

### Outbox
- [ ] Every write to the local database is accompanied by an outbox entry in the same transaction — not yet applicable; no local user-write flow exists yet (only `VehicleRepository.reconcile()`, a server-origin pull write, which correctly does *not* enqueue an outbox entry)
- [ ] If the transaction fails, neither the entity write nor the outbox entry is committed — same, not yet applicable
- [x] Outbox entries carry a UUID idempotency key — `OutboxRepository.enqueue()` uses `expo-crypto`'s `randomUUID()` as the entry `id`
- [ ] Duplicate outbox entries with the same idempotency key do not produce duplicate mutations on the API — not yet testable; no real handler calls the API yet

### Offline reads
- [x] All screens read from local SQLite and render without network access — true for every screen built so far (Garage, the only one reading Vehicle data); holds by construction for future screens too, since `Store<T>`/repositories are the only sanctioned data-access path
- [x] First launch shows a loading state until initial pull completes — `useGarageViewModel`'s `isLoading`, unit tested

### Sync
- [x] Outbox flush sends entries in `created_at` order — unit tested
- [x] On a retryable failure, flush stops; remaining entries stay `pending` for next trigger — implemented via `RetryableOutboxError`, not by `SyncService` inspecting HTTP status itself; see the Components section above and ADR 0027's 2026-07-02 update. Unit tested with fake handlers
- [x] On a permanent failure, entry is marked `failed`; flush continues — same mechanism; unit tested
- [x] Pull reconcile upserts API data and removes locally-present records absent from API response — `VehicleRepository.reconcile()`'s `replaceAll`; unit tested and verified on-device
- [ ] SyncProvider exposes `pendingCount` and `failedCount` for the offline indicator — only `pendingCount` exists; no `failedCount` (no UI surfaces failed entries yet)

### Offline indicator
- [x] Indicator appears when device is offline
- [x] Indicator appears when device is online but `pendingCount > 0` — fixed during this work; the initial implementation only checked `isOffline`
- [x] Indicator disappears when device is online and `pendingCount === 0`

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| expo-sqlite + Drizzle + SQLCipher | See ADR 0026 | Most downloaded Expo SQLite option; encrypted; manageable with Drizzle; no native build config |
| Outbox pattern | See ADR 0027 | Atomic writes, no soft deletes needed, idempotency keys prevent duplicates |
| Server wins on conflict | Overwrite local on pull | Single-user app; server is source of truth; conflicts only arise from multi-device use |
| Pull everything on sync | Full reconcile per entity type | Data volumes are small; avoids soft deletes and watermark complexity |
| `Store<T>` port, not `LocalDatabase` | Generic entity-store (`getAll`/`save`/`remove`/`replaceAll`), not raw SQL passthrough | See ADR 0026's 2026-07-02 update — the original port name and shape presupposed a SQL/database backend beyond what the capability itself needs to promise |
| `SyncService` dispatch is transport-agnostic | `RetryableOutboxError`, not `ApiError`/HTTP status inspection | See ADR 0027's 2026-07-02 update — HTTP-specific classification belongs at the handler boundary (where HTTP actually happens), not in the generic flush loop |
| Single-collection pull for now | Only `GET /vehicles` — no per-Vehicle detail, Log Entry, or account-data pull yet | No `LogEntryRepository`/`AccountRepository` exist; building the multi-collection phased-reconcile mechanism now would have no real caller. The approach for when it's needed is documented in ADR 0027's 2026-07-02 update |

---

## Out of scope

- Incremental pull with cursor / watermark → V2
- User-facing conflict resolution UI → V2
- Outbox retry backoff / exponential delay → V2
- Media sync (upload local files to cloud) → V2
- Multi-device conflict handling beyond last-write-wins → V2
- `LogEntryRepository`, `AccountRepository`, multi-collection pull/reconcile — next mobile screen(s) that need them (Vehicle Detail, Log Entry)
- Real outbox handlers (`CREATE_VEHICLE`, etc.) and the Idempotency-Key request header — Add Vehicle's responsibility
- `failedCount` / failed-entry surfacing UI — no producer of `failed` entries exists yet
