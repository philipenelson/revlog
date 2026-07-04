import * as Crypto from 'expo-crypto';
import type { LogEntrySummary } from '@maintenance-log/api-client';
import type { Store } from '@/infrastructure/database/Store';
import type { OutboxWriter } from '@/infrastructure/database/OutboxWriter';

// Local-only column, never exposed on this repository's public methods.
type LocalLogEntry = LogEntrySummary & { vehicleId: string };

export interface CreateLogEntryItemData {
  categoryId: string;
  description: string;
  quantity: number | null;
  unitCost: number | null;
}

// UC-MOB-LOG-1's fields — mirrors the web spec's CreateLogEntryPayload
// (docs/specs/garage/log-entry-api.md) minus `time` (not collected on
// mobile) and `media` (V2 on mobile — see docs/specs/mobile-app/
// log-entry.md's Decisions).
export interface CreateLogEntryData {
  typeId: string;
  title: string;
  date: string;
  mileage: number;
  notes: string | null;
  items: CreateLogEntryItemData[];
}

export interface LogEntryRepository {
  // Newest-first, matching GET /vehicles/:vehicleId/log's ordering (and the
  // web spec's default sort) — see docs/specs/mobile-app/vehicle.md.
  findByVehicleId(vehicleId: string): Promise<LogEntrySummary[]>;
  // Writes a new local row and enqueues a CREATE_LOG_ENTRY outbox entry,
  // atomically (OutboxWriter<T>) — same client-side id generation as
  // VehicleRepository.create(). Unlike Vehicle, nothing navigates by this
  // id afterwards (UC-MOB-LOG-1 returns to Vehicle Detail, not a Log Entry
  // Detail screen), so the temporary id is simply discarded and replaced by
  // the server's real one on the next sync's reconcile() — no need to send
  // it in the outbox payload, and no API support for it exists (unlike
  // Vehicle's client-generated id — see CreateVehiclePayload). Returns the
  // temporary local id.
  create(vehicleId: string, data: CreateLogEntryData): Promise<string>;
  // Replaces the entire local Log Entries collection across all Vehicles in
  // one pass. Called once per SyncService.pull(), after every Vehicle's
  // detail has been fetched — see ADR 0027's 2026-07-03 update.
  reconcile(entries: Array<LogEntrySummary & { vehicleId: string }>): Promise<void>;
}

export function createLogEntryRepository(
  store: Store<LocalLogEntry>,
  outboxWriter: OutboxWriter<LocalLogEntry>,
): LogEntryRepository {
  return {
    async findByVehicleId(vehicleId: string): Promise<LogEntrySummary[]> {
      const rows = await store.getAll({ where: { vehicleId }, orderBy: { field: 'date', direction: 'desc' } });
      return rows.map(({ vehicleId: _vehicleId, ...entry }) => entry);
    },

    async create(vehicleId: string, data: CreateLogEntryData): Promise<string> {
      const id = Crypto.randomUUID();
      const entry: LocalLogEntry = {
        id,
        vehicleId,
        typeId: data.typeId,
        title: data.title,
        date: data.date,
        time: null,
        mileage: data.mileage,
        itemCount: data.items.length,
        mediaCount: 0,
        totalCost: localItemsTotal(data.items),
      };
      await outboxWriter.save(entry, 'CREATE_LOG_ENTRY', { vehicleId, ...data });
      return id;
    },

    async reconcile(entries: Array<LogEntrySummary & { vehicleId: string }>): Promise<void> {
      await store.replaceAll(entries);
    },
  };
}

// Mirrors the web draft's itemsGrandTotal() (apps/web/src/domain/
// logEntryDraft.ts) — an optimistic local echo of what the API will compute
// as logEntry.totalCost; overwritten by the server's real decimal string on
// the next sync's reconcile().
function localItemsTotal(items: CreateLogEntryItemData[]): string | null {
  let sum = 0;
  let hasAny = false;
  for (const item of items) {
    if (item.quantity != null && item.unitCost != null) {
      sum += item.quantity * item.unitCost;
      hasAny = true;
    }
  }
  return hasAny ? sum.toFixed(2) : null;
}
