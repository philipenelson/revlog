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

### Update (2026-07-02): ordered multi-collection reconcile + client-generated ids

Gap found during the mobile Garage screen's design: this ADR describes reconciling "the local database" and flushing "the outbox" as if each were a single collection, but Vehicles and Log Entries are parent/child, and two ordering problems fall out of that which the original decision didn't address:

- **Pull-side**: if Vehicles and Log Entries are reconciled independently with no ordering guarantee, a Log Entry could transiently reconcile before its parent Vehicle exists locally (or after its parent has just been removed), and there is nothing in the original decision that rules this out.
- **Push-side**: a Log Entry created offline for a Vehicle also created offline references a Vehicle the server doesn't know about yet. If Vehicle ids are server-assigned (as `POST /vehicles` does today — no client-supplied `id`), the Log Entry's outbox entry cannot be resolved until the Vehicle's own outbox entry has been confirmed and its real id returned.

Two approaches were considered for the pull-side ordering problem beyond the two already in this ADR's Context (pull-everything, incremental-with-timestamps):

- **Soft delete + timestamp watermark** — this is already this ADR's "Incremental pull" V2+ item. It solves re-fetch cost and delete visibility more efficiently at scale, but does not by itself remove the parent-before-child ordering requirement — an incremental pull still needs to reconcile Vehicles before Log Entries within a batch. Confirmed as the right upgrade path once data volume/query cost justifies the added API scope (schema migration, cascading soft-deletes, every read needing a filter) — not yet, at this app's current scale (an Owner's handful of vehicles).
- **Phased reconcile within the existing hard-delete + full-replace approach** — reconcile parent collections to completion before starting dependent child collections, deriving the child pull's scope (which Vehicle ids to fetch Log Entries for) from the just-reconciled local parent state, not a pre-sync snapshot. No cross-collection transaction is needed: each phase is its own complete, atomic single-collection replace, so an interrupted sync leaves some collections stale, never a dangling reference. Combined with `PRAGMA foreign_keys = ON` and `ON DELETE CASCADE` on child tables (`log_entries.vehicle_id REFERENCES vehicles(id) ON DELETE CASCADE`), a parent removed by its collection's reconcile automatically removes its now-orphaned local children — mirroring the API's own cascading hard deletes (see the delete-vehicle spec) with no application code required.

**Decision:** use phased reconcile + FK cascade (the second option) for the pull side — it requires no API changes and no new decision beyond sequencing `SyncService.pull()`'s phases correctly. For the push side: entities that can be created offline and referenced by other offline-created entities (Vehicle, referenced by Log Entry) get a **client-generated id** (UUID, generated at local-create time and sent as-is to the API's create endpoint) rather than a server-assigned one. Combined with the outbox flush already processing entries in `created_at` order and *stopping* the whole flush (not skipping ahead) on a retryable failure, a dependent entity's mutation can never be sent before its parent's, because it was enqueued after it and the queue halts rather than reordering around a failure. This requires the relevant create endpoints (starting with `POST /vehicles`) to accept a client-supplied `id`, which they do not today — a prerequisite for whichever future work adds offline vehicle/log-entry creation (Add Vehicle, New Log Entry), not something this update implements itself.

This does not change the outbox pattern, the outbox table schema, or the server-wins conflict policy above — it refines *how* multi-collection reconcile is sequenced and *how* dependent offline-created entities get ordered on push. No code in the mobile Garage screen work ships against this yet (it reconciles a single collection, Vehicles, with no children); this is captured now so `LogEntryRepository` and Add Vehicle have a documented answer when they're built, per this repo's rule that a decision isn't made until it's written down.

### Update (2026-07-03): child-collection pull sourced from per-vehicle `GET /vehicles/:vehicleId`, not a standalone list endpoint

Gap found while building the Vehicle Detail screen (`LogEntryRepository`, the first consumer of the 2026-07-02 update above): that update assumed Log Entries would be pulled as a flat child collection, but the API has no endpoint that lists Log Entries across all of an account's Vehicles — the only ways to read a Vehicle's Log Entries are `GET /vehicles/:vehicleId` (full `VehicleDetail`: identity, insurance, `logEntries`, `stats`, `transferPending`/`pendingTransfer`) or `GET /vehicles/:vehicleId/log/:entryId` (one entry). Phase 2 of `pull()` therefore fetches the whole `VehicleDetail`, not just its `logEntries`.

**Decision:** phase 2 iterates the Vehicles just reconciled by phase 1 and calls `getVehicle(client, vehicle.id)` for each (N calls for N Vehicles — accepted at V1 scale for the same reason as this ADR's original "small data volumes" reasoning; revisit if an Owner's Vehicle count grows large enough to matter). For each response:

- The local Vehicle row is extended in place (`VehicleRepository.applyDetail`) with the fields `VehicleSummary` doesn't carry: `stats.totalSpent`, `stats.lastLoggedAt`, `transferPending`, and `pendingTransfer.recipientEmail` — this is what makes the Vehicle Detail screen's stats strip and locked-transfer state renderable from local SQLite alone, with no request in the render path.
- `logEntries` from every response are collected into one array and reconciled **once**, after the per-vehicle loop, via `LogEntryRepository.reconcile()` — a single full-collection replace, consistent with how `VehicleRepository.reconcile()` already works. This keeps `Store<T>.replaceAll()` as the only atomicity primitive needed; no per-vehicle-scoped replace was added to the `Store<T>` port.
- A per-vehicle `getVehicle` failure (network blip, or the Vehicle was deleted server-side between phase 1 and phase 2) is logged and skipped rather than aborting the whole pull — that Vehicle's detail fields and Log Entries simply stay stale until the next sync, which is the same "an interrupted sync leaves some collections stale, never a dangling reference" tradeoff this ADR already accepted for the phased-reconcile design.

**`insurance` is fetched but not persisted.** `VehicleDetail.insurance` comes back on every one of these calls, but no mobile screen reads or writes insurance yet (Vehicle Detail's V1 design has no insurance UI — see `docs/specs/mobile-app/vehicle.md`'s Decisions). Storing it now would be a local column with zero readers, which this repo's guidance is to avoid; it is discarded in `SyncService.pull()` today. This is deliberately deferred, not forgotten — captured here for whichever future work adds mobile insurance display so it has a documented starting point (probably a further extension of `applyDetail`) rather than re-deriving this call site from scratch.

**A failed per-vehicle detail fetch must not regress that Vehicle's already-known data.** Phase 1's `reconcile()` still has to run on every pull (it's the only phase that can add/remove Vehicles), but `VehicleSummary` alone can't populate the detail columns — so `reconcile()` looks up each Vehicle's current local row before replacing the table and carries its existing detail fields forward (falling back to `DEFAULT_DETAIL` only the first time a Vehicle is seen), rather than blanking them and waiting for phase 2 to refill them. Phase 2 then does the same for Log Entries on a failed fetch: it re-reads that Vehicle's current local entries via `LogEntryRepository.findByVehicleId()` and folds them back into the combined list before the single `reconcile()` call, since that call always replaces the whole table. Net effect: a Vehicle whose `getVehicle` call fails this cycle keeps exactly what it had after the last successful sync — stats, `transferPending`, and Log Entries all included — with no dependence on phase ordering within a single `pull()` to avoid a visible regression.

This does not change the outbox pattern, the outbox table schema, the server-wins conflict policy, or the 2026-07-02 update's phased-reconcile/FK-cascade/client-generated-id decisions — it answers the specific question that update left open ("what does `LogEntryRepository` actually pull from") now that `LogEntryRepository` exists.

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
