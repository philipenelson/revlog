import type { LogEntrySummary } from '@maintenance-log/api-client';
import type { Store } from '@/infrastructure/database/Store';

// Local-only column, never exposed on this repository's public methods.
type LocalLogEntry = LogEntrySummary & { vehicleId: string };

export interface LogEntryRepository {
  // Newest-first, matching GET /vehicles/:vehicleId/log's ordering (and the
  // web spec's default sort) — see docs/specs/mobile-app/vehicle.md.
  findByVehicleId(vehicleId: string): Promise<LogEntrySummary[]>;
  // Replaces the entire local Log Entries collection across all Vehicles in
  // one pass. Called once per SyncService.pull(), after every Vehicle's
  // detail has been fetched — see ADR 0027's 2026-07-03 update.
  reconcile(entries: Array<LogEntrySummary & { vehicleId: string }>): Promise<void>;
}

export function createLogEntryRepository(store: Store<LocalLogEntry>): LogEntryRepository {
  return {
    async findByVehicleId(vehicleId: string): Promise<LogEntrySummary[]> {
      const rows = await store.getAll({ where: { vehicleId }, orderBy: { field: 'date', direction: 'desc' } });
      return rows.map(({ vehicleId: _vehicleId, ...entry }) => entry);
    },

    async reconcile(entries: Array<LogEntrySummary & { vehicleId: string }>): Promise<void> {
      await store.replaceAll(entries);
    },
  };
}
