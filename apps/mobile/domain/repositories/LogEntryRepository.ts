import * as Crypto from 'expo-crypto';
import type { LogEntrySummary } from '@maintenance-log/api-client';
import type { Store } from '@/infrastructure/database/Store';
import type { OutboxWriter } from '@/infrastructure/database/OutboxWriter';

// Local-only columns, never exposed on this repository's public read
// methods — findByVehicleId strips them back to a plain LogEntrySummary;
// findById exposes notes/items through LogEntryFullDetail instead of the
// raw itemsJson string. See ADR 0027's 2026-07-04 update.
export type LocalLogEntry = LogEntrySummary & {
  vehicleId: string;
  notes: string | null;
  itemsJson: string;
  detailFetched: boolean;
};

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

// UC-MOB-LOG-2's fields — same shape as CreateLogEntryData, mirroring
// VehicleRepository's separate Create/UpdateVehicleData convention (kept
// distinct for clarity even where the shape is identical).
export interface UpdateLogEntryData {
  typeId: string;
  title: string;
  date: string;
  mileage: number;
  notes: string | null;
  items: CreateLogEntryItemData[];
}

// findById()'s return shape — mirrors the web spec's LogEntryDetail minus
// `media` (mobile V2), the source Edit Log Entry pre-fills its form from.
export interface LogEntryFullDetail {
  id: string;
  typeId: string;
  title: string;
  date: string;
  time: string | null;
  mileage: number | null;
  notes: string | null;
  items: CreateLogEntryItemData[];
}

export interface LogEntryDetailFields {
  notes: string | null;
  items: CreateLogEntryItemData[];
}

export interface LogEntryRepository {
  // Newest-first, matching GET /vehicles/:vehicleId/log's ordering (and the
  // web spec's default sort) — see docs/specs/mobile-app/vehicle.md.
  findByVehicleId(vehicleId: string): Promise<LogEntrySummary[]>;
  // Full detail (notes + items) for Edit Log Entry's pre-fill. Returns null
  // if the id isn't known locally at all — the entry's own row, not just
  // its detail, is missing.
  findById(id: string): Promise<LogEntryFullDetail | null>;
  // Writes a new local row and enqueues a CREATE_LOG_ENTRY outbox entry,
  // atomically (OutboxWriter<T>) — same client-side id generation as
  // VehicleRepository.create(). Unlike Vehicle, nothing navigates by this
  // id afterwards (UC-MOB-LOG-1 returns to Vehicle Detail, not a Log Entry
  // Detail screen), so the temporary id is simply discarded and replaced by
  // the server's real one on the next sync's reconcile() — no need to send
  // it in the outbox payload, and no API support for it exists (unlike
  // Vehicle's client-generated id — see CreateVehiclePayload). Returns the
  // temporary local id. Writes notes/items into the local row immediately
  // (detailFetched: true) — this device already has the full data in hand,
  // no need to wait for a sync round trip (ADR 0027's 2026-07-04 update).
  create(vehicleId: string, data: CreateLogEntryData): Promise<string>;
  // UC-MOB-LOG-2: applies `data` to the local row and enqueues an
  // UPDATE_LOG_ENTRY outbox entry, atomically. No-op if the entry isn't
  // known locally. Same immediate detailFetched: true reasoning as
  // create() — the Owner's own edit is the freshest copy of notes/items
  // there is.
  update(vehicleId: string, entryId: string, data: UpdateLogEntryData): Promise<void>;
  // UC-MOB-LOG-3: deletes the local row and enqueues a DELETE_LOG_ENTRY
  // outbox entry, atomically. No-op if the entry isn't known locally.
  delete(vehicleId: string, entryId: string): Promise<void>;
  // Replaces the entire local Log Entries collection across all Vehicles in
  // one pass. Called once per SyncService.pull(), after every Vehicle's
  // detail has been fetched — see ADR 0027's 2026-07-03 update. Carries
  // forward each entry's cached notes/items if already detailFetched
  // (ADR 0027's 2026-07-04 update), and returns the ids of entries that
  // still need a detail fetch (never seen before, or a prior fetch never
  // completed) so SyncService.pull() can fetch exactly those.
  reconcile(entries: Array<LogEntrySummary & { vehicleId: string }>): Promise<string[]>;
  // Merges fetched notes/items into an already-reconciled row, marking it
  // detailFetched. Called by SyncService.pull()'s new detail-fetch phase,
  // once per id reconcile() flagged. No-op if the row is gone by the time
  // the fetch resolves.
  applyDetail(id: string, detail: LogEntryDetailFields): Promise<void>;
}

export function createLogEntryRepository(
  store: Store<LocalLogEntry>,
  outboxWriter: OutboxWriter<LocalLogEntry>,
): LogEntryRepository {
  async function findRow(id: string): Promise<LocalLogEntry | undefined> {
    const [row] = await store.getAll({ where: { id } });
    return row;
  }

  return {
    async findByVehicleId(vehicleId: string): Promise<LogEntrySummary[]> {
      const rows = await store.getAll({ where: { vehicleId }, orderBy: { field: 'date', direction: 'desc' } });
      return rows.map(stripLocalFields);
    },

    async findById(id: string): Promise<LogEntryFullDetail | null> {
      const row = await findRow(id);
      if (!row) return null;
      const { vehicleId: _vehicleId, itemCount: _itemCount, mediaCount: _mediaCount, totalCost: _totalCost, detailFetched: _detailFetched, itemsJson, ...rest } = row;
      return { ...rest, items: JSON.parse(itemsJson) as CreateLogEntryItemData[] };
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
        notes: data.notes,
        itemsJson: JSON.stringify(data.items),
        detailFetched: true,
      };
      await outboxWriter.save(entry, 'CREATE_LOG_ENTRY', { vehicleId, ...data });
      return id;
    },

    async update(vehicleId: string, entryId: string, data: UpdateLogEntryData): Promise<void> {
      const row = await findRow(entryId);
      if (!row) return;
      const updated: LocalLogEntry = {
        ...row,
        typeId: data.typeId,
        title: data.title,
        date: data.date,
        mileage: data.mileage,
        itemCount: data.items.length,
        totalCost: localItemsTotal(data.items),
        notes: data.notes,
        itemsJson: JSON.stringify(data.items),
        detailFetched: true,
      };
      await outboxWriter.save(updated, 'UPDATE_LOG_ENTRY', { vehicleId, entryId, ...data });
    },

    async delete(vehicleId: string, entryId: string): Promise<void> {
      const row = await findRow(entryId);
      if (!row) return;
      await outboxWriter.remove(entryId, 'DELETE_LOG_ENTRY', { vehicleId, entryId });
    },

    async reconcile(entries: Array<LogEntrySummary & { vehicleId: string }>): Promise<string[]> {
      const existing = await store.getAll();
      const existingById = new Map(existing.map((row) => [row.id, row]));
      const needsDetail: string[] = [];
      const rows: LocalLogEntry[] = entries.map((entry) => {
        const prior = existingById.get(entry.id);
        if (prior?.detailFetched) {
          return { ...entry, notes: prior.notes, itemsJson: prior.itemsJson, detailFetched: true };
        }
        needsDetail.push(entry.id);
        return { ...entry, notes: null, itemsJson: '[]', detailFetched: false };
      });
      await store.replaceAll(rows);
      return needsDetail;
    },

    async applyDetail(id: string, detail: LogEntryDetailFields): Promise<void> {
      const row = await findRow(id);
      if (!row) return;
      await store.save({ ...row, notes: detail.notes, itemsJson: JSON.stringify(detail.items), detailFetched: true });
    },
  };
}

function stripLocalFields(row: LocalLogEntry): LogEntrySummary {
  const { vehicleId: _vehicleId, notes: _notes, itemsJson: _itemsJson, detailFetched: _detailFetched, ...summary } = row;
  return summary;
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
