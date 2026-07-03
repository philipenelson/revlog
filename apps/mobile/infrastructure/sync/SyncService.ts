import { listVehicles, getVehicle, type HttpClient, type LogEntrySummary } from '@maintenance-log/api-client';
import type { VehicleRepository } from '@/domain/repositories/VehicleRepository';
import type { LogEntryRepository } from '@/domain/repositories/LogEntryRepository';
import type { OutboxRepository } from '@/domain/repositories/OutboxRepository';
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
}: SyncServiceDeps): SyncService {
  // Phased parent-then-child pull (ADR 0027's 2026-07-02 update). Phase 1:
  // GET /vehicles (list) and reconcile — this is the only phase that can
  // add/remove Vehicles. Phase 2: for each just-reconciled Vehicle, GET
  // /vehicles/:vehicleId — there is no endpoint that lists Log Entries
  // across Vehicles, so fetching each Vehicle's full Detail is also how
  // stats/transferPending/logEntries are sourced (ADR 0027's 2026-07-03
  // update). Log Entries from every Vehicle are reconciled in one call
  // after the loop, matching the "single-collection replace" shape
  // LogEntryRepository already offers.
  async function pull(): Promise<void> {
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

    await logEntryRepository.reconcile(allLogEntries);
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
