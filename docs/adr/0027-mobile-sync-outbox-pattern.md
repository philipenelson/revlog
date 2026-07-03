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

### Update (2026-07-03): `OutboxWriter<T>` — cross-table atomic write port for offline entity writes

Gap found while building Edit Vehicle (UC-MOB-VEH-3), the first mobile screen that actually writes offline: this ADR's Decision says "Writes go to SQLite and the outbox in a single atomic transaction," but no code path implements that yet. `Store<T>` — the only write primitive that exists — is deliberately scoped to one collection (this ADR's 2026-07-02 update: "no cross-collection transaction() method... each phase is its own complete, atomic single-collection replace"), and a write that also enqueues an outbox entry touches two collections (the entity's table and `outbox`) that don't share a `Store<T>` instance: `DatabaseProvider` constructs one `Store<T>` per table, so a repository's `update()` has no way to reach the outbox table's rows through the store it's given.

Two approaches were considered:

- **Sequential writes** — the repository calls `store.save()` then a separate `outboxRepository.enqueue()`, un-transacted. Simplest, but violates this ADR's own atomicity requirement: a crash or app kill between the two calls leaves a locally "saved" edit that never reaches the outbox, silently losing the write with no user-visible signal — exactly what the outbox pattern exists to prevent.
- **`OutboxWriter<T>`, a second, narrower port** — `save(record: T, outboxType: string, outboxPayload: unknown): Promise<void>` that writes both tables inside one `db.transaction()` call. Kept separate from `Store<T>` rather than folded into it, because `Store<T>` is deliberately generic and SQL-agnostic (its own header comment: "not named or shaped after a database... nothing here presupposes SQL") and used everywhere, including read paths and the pull-side `replaceAll()` that have no outbox involvement at all. Making every `Store<T>` call site outbox-aware would be a much bigger, unrelated change for a capability only offline-write repositories need.

**Decision:** add `OutboxWriter<T>` (`infrastructure/database/OutboxWriter.ts`), implemented by `createOutboxWriter(db, table)` in `SQLiteStore.ts` using the same synchronous `db.transaction()` primitive `SQLiteStore.replaceAll()` already uses — one transaction upserts the entity row (`onConflictDoUpdate`, same semantics as `Store<T>.save()`) and inserts the outbox row, so a crash between the two is impossible: either both commit or neither does. A repository that needs this (today: `VehicleRepository.update()`; the same shape will serve `create`/`delete` and later `LogEntryRepository` writes) is constructed with both its `Store<T>` (for reads and non-outbox writes) and an `OutboxWriter<T>` scoped to the same table. `DatabaseProvider` wires both from the same `DrizzleDb` instance.

This does not change the outbox pattern, the outbox table schema, or the conflict policy — it is the concrete mechanism this ADR's original Decision described but never specified, now that a write path actually needs it.

### Update (2026-07-03): `POST /vehicles` accepts a client-supplied `id`

Fulfils the prerequisite the 2026-07-02 update flagged and deferred: "this requires the relevant create endpoints... to accept a client-supplied `id`, which they do not today... a prerequisite for whichever future work adds offline vehicle/log-entry creation (Add Vehicle, New Log Entry)." Add Vehicle (UC-MOB-VEH-2) is that work.

**Decision:** `createVehicleSchema` (`packages/domain`) gains an optional `id: z.uuid()` field, validated and forwarded end-to-end — `CreateVehicleData`/`IVehicleRepository.create` accept it, and `PrismaVehicleRepository.create` uses `vehicle.upsert({ where: { id }, create: data, update: {} })` instead of a plain `create` whenever an `id` is supplied. The web client never sends one, so `Vehicle.id`'s Prisma default (`@default(uuid())`) still applies there unchanged.

The upsert-with-no-op-update (rather than a plain `create`) is what makes this ADR's original idempotency promise ("retrying with the same id is safe") actually hold for creates specifically: `VehicleRepository.create()` on mobile (see below) generates the id at local-write time, before the outbox entry has been sent even once, so a retried `CREATE_VEHICLE` outbox entry — e.g. the request reached the server and committed, but the response was lost before the client saw it — resolves to the same row instead of a unique-constraint error.

**Known limitation, deliberately not solved here:** this only covers the "same id resubmitted" case at the row level. A retried create is still classified by `outboxHandlers.ts`'s existing `isRetryable()` the same as any other mutation (5xx/network → retryable, 4xx → permanent) — it does not special-case "this looks like the same request landed already." That's fine for the common failure mode (the request never reached the server), and the upsert above means it's also fine for the "reached the server, response lost" case. Revisit only if a distinct failure mode turns up in practice that this doesn't cover.

**Adjacent bug found and fixed while wiring `CREATE_VEHICLE`'s payload:** `createVehicleSchema`'s `nickname` field only accepted `undefined` (the web client's shape — `draft.nickname.trim() || undefined`) or a real string, not an explicit `null`. Every mobile outbox payload (`CreateVehicleData`/`UpdateVehicleData`, both typed `nickname: string | null`) sends the field with a value, never omits the key, so a blank nickname serializes to `"nickname": null` on the wire — which the schema rejected outright (400) before this fix. This would have broken the common "no nickname" case for both `CREATE_VEHICLE` (new, this update) and the already-shipped `UPDATE_VEHICLE` (Edit Vehicle, whenever a nickname is cleared — a path with no existing test coverage, which is how it went unnoticed). Fixed by adding `.nullable()` to the field in `packages/domain/src/schemas/vehicle.ts`, a pure widening: `null`, `undefined`, and a real string all still collapse to the same transformed output. See `docs/specs/mobile-app/vehicle.md`'s Decisions for the spec-level record.

**Mobile side:** `VehicleRepository.create()` generates the id via `Crypto.randomUUID()` (the same primitive `OutboxRepository` and `secureStorage` already use for client-generated ids elsewhere in this app) and writes it through `OutboxWriter<T>` — entity row and `CREATE_VEHICLE` outbox entry in one transaction, the same shape this ADR's 2026-07-03 `OutboxWriter<T>` update already established for `update()`. `outboxHandlers.ts` gets a `CREATE_VEHICLE` handler calling `createVehicle(client, { id, ...data })`, classified retryable/permanent identically to `UPDATE_VEHICLE`'s existing handler.

This does not change the outbox pattern, the outbox table schema, or the conflict policy — it closes the one open prerequisite the 2026-07-02 update left for offline entity creation.

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
