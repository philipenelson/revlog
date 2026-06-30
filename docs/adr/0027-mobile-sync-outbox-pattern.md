# Mobile sync: outbox pattern with SyncService

## Context

The mobile app is offline-first: all reads come from the local SQLite database and all writes must be possible without a network connection. When connectivity is restored, local changes must be reliably delivered to the API without duplicates.

Three sync approaches were considered:

**Pull-everything on reconnect** — on reconnect, push any pending local changes then fetch all Vehicles and Log Entries from the API and overwrite the local database. Simple to implement and viable given the small data volumes an Owner accumulates. However, it does not handle the case where a record was deleted: the API returns only what exists, so a locally-deleted record would be restored on the next pull. It also re-fetches the entire dataset on every reconnect, which is wasteful.

**Incremental sync with timestamps** — track an `updatedAt` watermark and pull only records modified since the last sync. Requires soft deletes on the API (hard deletes are invisible to a timestamp query). The current API uses hard deletes on Vehicles with cascading child deletion; converting to soft deletes is significant additional API scope on top of the mobile work.

**Outbox pattern** — every write (create, update, delete) is applied to the local SQLite database immediately, and an outbox entry is written in the same database transaction. A `SyncService` reads the outbox when online and sends each pending mutation to the API in order. The UI always reads from the local database and never waits for the network.

## Decision

Use the **outbox pattern**. Writes go to SQLite and the outbox in a single atomic transaction. The `SyncService` flushes the outbox to the API when online.

### Outbox table schema

```sql
CREATE TABLE outbox (
  id            TEXT PRIMARY KEY,     -- UUID, also the idempotency key
  type          TEXT NOT NULL,        -- e.g. 'CREATE_LOG_ENTRY', 'DELETE_VEHICLE'
  payload       TEXT NOT NULL,        -- JSON string
  created_at    INTEGER NOT NULL,     -- Unix timestamp ms
  status        TEXT NOT NULL DEFAULT 'pending'
                                      -- 'pending' | 'processing' | 'failed'
);

CREATE UNIQUE INDEX outbox_id ON outbox(id);
```

The `id` doubles as an idempotency key. If a mutation is sent to the API and the response is lost before the client receives it, retrying with the same `id` is safe — the server either recognises the key and returns the previous result, or the mutation is truly new. New idempotency-keyed endpoints are added to the API as needed for mutating operations.

### SyncService

`SyncService` lives in `infrastructure/sync/SyncService.ts`. It:

1. Subscribes to network state changes (`@react-native-community/netinfo`)
2. On connectivity restored: flushes the outbox — processes `pending` entries in `created_at` order, one at a time, marking each `processing` then deleting on success or `failed` on unrecoverable error
3. On explicit refresh (pull-to-refresh or app foreground): pulls all data from the API and reconciles the local database (upsert for existing records, delete locally any record not present in the API response)
4. Exposes `pendingCount` — the count of unsynced outbox entries — so the offline indicator can reflect unsent changes even when the device is online

### Conflict resolution

Server wins. If the API rejects a mutation (e.g. the record was deleted server-side since the local write), the outbox entry is marked `failed` and the local record is reverted on the next pull. This is the correct policy for a single-user app: the server is the source of truth, and conflicts only arise from multiple devices or sessions.

### Offline indicator

The header shows the offline indicator when `networkState.isConnected === false` OR `outboxPendingCount > 0`. This tells the Owner that either they are offline, or they are online but local changes have not yet been confirmed by the server.

## Status

accepted

## Consequences

- Writes are instant from the user's perspective — no spinner waiting for the network on create/update/delete.
- The outbox is a plain SQLite table; no third-party sync library or hosted service is required.
- Idempotency keys prevent duplicate writes on retry; the server-side implementation of idempotency keys is additive (no breaking API changes).
- The pull-on-refresh step means an Owner who opens the app after a long offline period gets a full reconcile, which is correct.
- Failed outbox entries are surfaced to the SyncService for monitoring; V2 can add user-facing retry or conflict resolution UI.

## V2+ items

- **Incremental pull** — once data volumes grow, replace the pull-everything reconcile with a cursor-based pull. Requires soft deletes on the API and a `changedSince` cursor endpoint.
- **User-facing conflict resolution** — when the server rejects a local mutation, surface the conflict to the Owner rather than silently reverting.
- **Outbox retry backoff** — exponential backoff on `failed` entries to avoid hammering a degraded API.
