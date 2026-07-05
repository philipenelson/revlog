import { listVehicles, getVehicle, getLogEntry, getCurrentUser, type HttpClient, type LogEntrySummary } from '@maintenance-log/api-client';
import type { VehicleRepository } from '@/domain/repositories/VehicleRepository';
import type { LogEntryRepository } from '@/domain/repositories/LogEntryRepository';
import type { OutboxRepository } from '@/domain/repositories/OutboxRepository';
import type { ProfileRepository } from '@/domain/repositories/ProfileRepository';
import { logger } from '@/infrastructure/logging/logger';

// Thrown by an outbox handler to mean "this failed for a retryable reason
// (5xx, network, timeout) — stop the flush, leave this entry pending, try
// again on the next trigger." Any other thrown error is treated as
// permanent. This is the only error type flushOutbox() itself knows about —
// it never sees ApiError or an HTTP status; a handler that actually calls
// the API is responsible for classifying its own failures and re-throwing
// this where appropriate (see ADR 0026's 2026-07-02 update for why the same
// separation applies to Store<T>). No handler exists yet in this pass — see
// ADR 0027's 2026-07-02 update.
export class RetryableOutboxError extends Error {}

export type OutboxHandler = (payload: unknown) => Promise<void>;

interface SyncServiceDeps {
  client: HttpClient;
  vehicleRepository: VehicleRepository;
  logEntryRepository: LogEntryRepository;
  outboxRepository: OutboxRepository;
  handlers: Record<string, OutboxHandler>;
  // Optional: pull() caches the current user's profile (GET /users/me) when
  // present, for the offline-first Settings Account section (ADR 0033).
  profileRepository?: ProfileRepository;
}

export interface SyncService {
  pull(): Promise<void>;
  flushOutbox(): Promise<void>;
  runFullSync(): Promise<void>;
}

export function createSyncService({
  client,
  vehicleRepository,
  logEntryRepository,
  outboxRepository,
  handlers,
  profileRepository,
}: SyncServiceDeps): SyncService {
  // Phased parent-then-child pull (ADR 0027's 2026-07-02 update). Phase 1:
  // GET /vehicles (list) and reconcile — this is the only phase that can
  // add/remove Vehicles. Phase 2: for each just-reconciled Vehicle, GET
  // /vehicles/:vehicleId — there is no endpoint that lists Log Entries
  // across Vehicles, so fetching each Vehicle's full Detail is also how
  // stats/transferPending/logEntries are sourced (ADR 0027's 2026-07-03
  // update). Log Entries from every Vehicle are reconciled in one call
  // after the loop, matching the "single-collection replace" shape
  // LogEntryRepository already offers. Phase 3 (ADR 0027's 2026-07-04
  // update): for whichever entries reconcile() reports as not yet
  // detail-fetched, fetch full detail (notes + items) via GET
  // /vehicles/:vehicleId/log/:entryId and cache it locally — this is what
  // lets Edit Log Entry pre-fill purely from SQLite.
  async function pull(): Promise<void> {
    // Current-user profile (GET /users/me) for the Settings Account section.
    // Independent of vehicles; a failure keeps the last-known cached profile
    // (offline-first stale-over-empty, ADR 0033) rather than aborting the
    // whole pull.
    if (profileRepository) {
      try {
        await profileRepository.save(await getCurrentUser(client));
      } catch (err) {
        logger.warn('sync: failed to fetch user profile, keeping cached', { err: String(err) });
      }
    }

    const vehicles = await listVehicles(client);
    await vehicleRepository.reconcile(vehicles);

    const allLogEntries: Array<LogEntrySummary & { vehicleId: string }> = [];

    for (const vehicle of vehicles) {
      try {
        const detail = await getVehicle(client, vehicle.id);
        await vehicleRepository.applyDetail(vehicle.id, {
          totalSpent: detail.stats.totalSpent,
          lastLoggedAt: detail.stats.lastLoggedAt,
          transferPending: detail.transferPending,
          pendingTransferRecipientEmail: detail.pendingTransfer?.recipientEmail ?? null,
        });
        allLogEntries.push(...detail.logEntries.map((entry) => ({ ...entry, vehicleId: vehicle.id })));
      } catch (err) {
        // Reconcile()'s detail-field preservation already keeps this
        // Vehicle's stats/transferPending from last cycle intact — mirror
        // that here for its Log Entries, so a single failed detail fetch
        // doesn't wipe entries that synced fine last time (reconcile()
        // below always replaces the whole collection).
        logger.warn('sync: failed to fetch vehicle detail, keeping last-known data', {
          vehicleId: vehicle.id,
          err: String(err),
        });
        const stale = await logEntryRepository.findByVehicleId(vehicle.id);
        allLogEntries.push(...stale.map((entry) => ({ ...entry, vehicleId: vehicle.id })));
      }
    }

    const needsDetail = await logEntryRepository.reconcile(allLogEntries);

    // Bounded, not per-entry-per-pull: only entries reconcile() has never
    // cached full detail for (new this pull, or a prior fetch never
    // completed) get fetched — see ADR 0027's 2026-07-04 update for why this
    // differs from phase 2's unconditional per-vehicle refetch.
    const vehicleIdByEntryId = new Map(allLogEntries.map((entry) => [entry.id, entry.vehicleId]));
    for (const entryId of needsDetail) {
      const vehicleId = vehicleIdByEntryId.get(entryId);
      if (!vehicleId) continue;
      try {
        const full = await getLogEntry(client, vehicleId, entryId);
        await logEntryRepository.applyDetail(entryId, {
          notes: full.notes,
          items: full.items.map((item) => ({
            categoryId: item.categoryId,
            description: item.description,
            quantity: item.quantity !== null ? Number(item.quantity) : null,
            unitCost: item.unitCost !== null ? Number(item.unitCost) : null,
          })),
        });
      } catch (err) {
        // detailFetched stays false, so the next pull's reconcile() will
        // report this id again — a transient failure self-heals instead of
        // permanently losing this entry's detail.
        logger.warn('sync: failed to fetch log entry detail, will retry next pull', {
          entryId,
          err: String(err),
        });
      }
    }
  }

  // Per ADR 0027: pending entries in created_at order, one at a time. No
  // handler registered for an entry's type -> treat as unrecoverable (today
  // this is every entry, since nothing enqueues yet). A RetryableOutboxError
  // stops the whole flush, preserving order for every entry still pending —
  // this is also what makes a dependent entry (e.g. a Log Entry referencing
  // a Vehicle not yet confirmed by the server) safe without any cross-entry
  // coordination: it was enqueued after its dependency, so it's never
  // reached until the dependency has actually succeeded.
  async function flushOutbox(): Promise<void> {
    const pending = await outboxRepository.listPending();

    for (const entry of pending) {
      await outboxRepository.markStatus(entry.id, 'processing');
      const handler = handlers[entry.type];

      if (!handler) {
        logger.warn('outbox: no handler registered for entry type', { type: entry.type });
        await outboxRepository.markStatus(entry.id, 'failed');
        continue;
      }

      try {
        await handler(JSON.parse(entry.payload));
        await outboxRepository.remove(entry.id);
      } catch (err) {
        if (err instanceof RetryableOutboxError) {
          logger.warn('outbox: retryable failure, stopping flush', { type: entry.type, err: String(err) });
          await outboxRepository.markStatus(entry.id, 'pending');
          return;
        }
        logger.error('outbox: permanent failure', { type: entry.type, err: String(err) });
        await outboxRepository.markStatus(entry.id, 'failed');
      }
    }
  }

  async function runFullSync(): Promise<void> {
    await flushOutbox();
    await pull();
  }

  return { pull, flushOutbox, runFullSync };
}
