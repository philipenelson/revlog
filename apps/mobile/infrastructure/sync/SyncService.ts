import { listVehicles, type HttpClient } from '@maintenance-log/api-client';
import type { VehicleRepository } from '@/domain/repositories/VehicleRepository';
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
  outboxRepository: OutboxRepository;
  handlers: Record<string, OutboxHandler>;
}

export interface SyncService {
  pull(): Promise<void>;
  flushOutbox(): Promise<void>;
  runFullSync(): Promise<void>;
}

export function createSyncService({ client, vehicleRepository, outboxRepository, handlers }: SyncServiceDeps): SyncService {
  // Single collection only — Vehicles. The phased parent-then-child
  // sequencing for when Log Entries join the pull is documented in ADR
  // 0027's 2026-07-02 update, not implemented here (no LogEntryRepository
  // exists yet).
  async function pull(): Promise<void> {
    const vehicles = await listVehicles(client);
    await vehicleRepository.reconcile(vehicles);
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
