# Mobile Offline Sync Spec

**Area:** Mobile / Infrastructure
**Status:** Not started
**Last updated:** 2026-06-30

---

## Overview

The mobile app is fully offline-first. All reads come from a local SQLite database on the device. All writes are applied locally and queued for sync. A `SyncService` flushes the outbox and pulls server data when online. Data is encrypted at rest via SQLCipher.

This spec covers the offline/sync infrastructure. See ADR 0026 (database) and ADR 0027 (outbox pattern) for architectural decisions.

---

## Components

### LocalDatabase port

```ts
// infrastructure/database/LocalDatabase.ts
export interface LocalDatabase {
  execute(sql: string, params?: unknown[]): Promise<void>;
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  transaction(fn: (db: LocalDatabase) => Promise<void>): Promise<void>;
}
```

`SQLiteLocalDatabase` in `infrastructure/database/SQLiteLocalDatabase.ts` implements this port using expo-sqlite with the SQLCipher `key` option. The encryption key is stored in `expo-secure-store`.

### Repositories

Domain repositories in `domain/repositories/` provide entity-level abstractions over the `LocalDatabase` port:

- `VehicleRepository` — CRUD for Vehicles
- `LogEntryRepository` — CRUD for Log Entries and Log Items
- `OutboxRepository` — enqueue, list pending, mark status, delete
- `AccountRepository` — cache account/user data

ViewModels call repositories. Repositories call `LocalDatabase`. Nothing in `application/` touches the database or sync layer directly.

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

`infrastructure/sync/SyncService.ts` runs as a background service mounted in `SyncProvider` at the application root.

**Outbox flush (triggered on connectivity restored and on app foreground):**

1. Fetch all `pending` outbox entries ordered by `created_at`.
2. For each entry:
   a. Mark `processing`.
   b. Call the appropriate API endpoint via `TokenHttpClient`, including the entry `id` as the idempotency key header (`Idempotency-Key: <id>`).
   c. On success: delete the outbox entry.
   d. On 4xx (except 409): mark `failed`. Log the error. Continue to next entry.
   e. On 5xx or network error: leave as `pending`. Stop flush (retry on next trigger).
3. On completion: trigger a pull.

**Pull (triggered after outbox flush, on pull-to-refresh, and on app foreground):**

1. Call `GET /vehicles` — reconcile Vehicle list in local SQLite (upsert existing, delete absent).
2. For each Vehicle, call `GET /vehicles/:vehicleId` — reconcile Vehicle detail, Log Entries, and Log Items.
3. Update locally cached account and user data from `GET /auth/me`.
4. Emit update events so repositories notify viewmodels of fresh data.

**Conflict resolution:** Server wins. If the pull overwrites a locally-optimistic value, the viewmodel re-renders with the server data. Failed outbox entries are visible in `OutboxRepository.listFailed()` for future surface in V2.

### SyncProvider

`application/providers/SyncProvider.tsx` mounts `SyncService` and exposes via context:

- `networkState: { isConnected: boolean }`
- `outbox: { pendingCount: number; failedCount: number }`
- `sync: { status: 'idle' | 'syncing' | 'error'; lastSyncedAt: Date | null }`
- `refresh(): Promise<void>` — trigger an explicit pull-to-refresh

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
- [ ] Local SQLite database file is encrypted with SQLCipher; encryption key is stored in expo-secure-store
- [ ] The database file cannot be read by another app or via the device file system

### Outbox
- [ ] Every write to the local database is accompanied by an outbox entry in the same transaction
- [ ] If the transaction fails, neither the entity write nor the outbox entry is committed
- [ ] Outbox entries carry a UUID idempotency key
- [ ] Duplicate outbox entries with the same idempotency key do not produce duplicate mutations on the API

### Offline reads
- [ ] All screens read from local SQLite and render without network access
- [ ] First launch shows a loading state until initial pull completes

### Sync
- [ ] Outbox flush sends entries in `created_at` order
- [ ] On 5xx or network error, flush stops; remaining entries stay `pending` for next trigger
- [ ] On 4xx (except 409), entry is marked `failed`; flush continues
- [ ] Pull reconcile upserts API data and removes locally-present records absent from API response
- [ ] SyncProvider exposes `pendingCount` and `failedCount` for the offline indicator

### Offline indicator
- [ ] Indicator appears when device is offline
- [ ] Indicator appears when device is online but `pendingCount > 0`
- [ ] Indicator disappears when device is online and `pendingCount === 0`

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| expo-sqlite + Drizzle + SQLCipher | See ADR 0026 | Most downloaded Expo SQLite option; encrypted; manageable with Drizzle; no native build config |
| Outbox pattern | See ADR 0027 | Atomic writes, no soft deletes needed, idempotency keys prevent duplicates |
| Server wins on conflict | Overwrite local on pull | Single-user app; server is source of truth; conflicts only arise from multi-device use |
| Pull everything on sync | Full reconcile per entity type | Data volumes are small; avoids soft deletes and watermark complexity |

---

## Out of scope

- Incremental pull with cursor / watermark → V2
- User-facing conflict resolution UI → V2
- Outbox retry backoff / exponential delay → V2
- Media sync (upload local files to cloud) → V2
- Multi-device conflict handling beyond last-write-wins → V2
