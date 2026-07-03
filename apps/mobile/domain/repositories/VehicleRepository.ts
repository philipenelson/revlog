import * as Crypto from 'expo-crypto';
import type { VehicleSummary } from '@maintenance-log/api-client';
import type { Store } from '@/infrastructure/database/Store';
import type { OutboxWriter } from '@/infrastructure/database/OutboxWriter';
import { persistVehiclePhoto, type PickedPhoto } from '@/infrastructure/storage/photoStorage';

// Vehicle Detail-only fields — VehicleSummary (GET /vehicles) can't supply
// these; they come from GET /vehicles/:vehicleId. See ADR 0027's 2026-07-03
// update.
export interface VehicleDetailFields {
  totalSpent: string | null;
  lastLoggedAt: string | null;
  transferPending: boolean;
  pendingTransferRecipientEmail: string | null;
}

const DEFAULT_DETAIL: VehicleDetailFields = {
  totalSpent: null,
  lastLoggedAt: null,
  transferPending: false,
  pendingTransferRecipientEmail: null,
};

export type LocalVehicleDetail = VehicleSummary & VehicleDetailFields;

// Local-only column, never exposed on this repository's public methods —
// preserves GET /vehicles' response order across a local read (see
// infrastructure/database/schema.ts).
type LocalVehicle = LocalVehicleDetail & { sortOrder: number };

// UC-MOB-VEH-3's editable fields — mirrors the web spec's UpdateVehiclePayload
// (docs/specs/garage/edit-vehicle.md): always sent in full, not a partial
// diff, matching how the web Edit Vehicle screen submits.
export interface UpdateVehicleData {
  nickname: string | null;
  make: string;
  model: string;
  year: number;
  mileage: number;
}

// UC-MOB-VEH-2's fields — same shape as UpdateVehicleData minus the id,
// mirrors the web spec's CreateVehiclePayload (docs/specs/garage/
// vehicle-creation-api.md).
export interface CreateVehicleData {
  nickname: string | null;
  make: string;
  model: string;
  year: number;
  mileage: number;
}

export interface VehicleRepository {
  findAll(): Promise<VehicleSummary[]>;
  findById(id: string): Promise<LocalVehicleDetail | null>;
  // Writes a new local row and enqueues a CREATE_VEHICLE outbox entry,
  // atomically (OutboxWriter<T>). Generates the Vehicle's id client-side
  // (Crypto.randomUUID(), the same primitive OutboxRepository and
  // secureStorage already use) so the screen can navigate to the new
  // Vehicle's Detail screen before the create has ever reached the server —
  // ADR 0027's 2026-07-03 update. Returns the new id.
  //
  // If `photo` is given, it's persisted to stable local storage (keyed by
  // the new id) before the outbox entry is written, and the entry's payload
  // carries that stable reference — see ADR 0027's 2026-07-03
  // "offline-durable photo upload" update.
  create(data: CreateVehicleData, photo?: PickedPhoto): Promise<string>;
  // Applies `data` to the local row and enqueues an UPDATE_VEHICLE outbox
  // entry, atomically (OutboxWriter<T> — see ADR 0027's 2026-07-03 update).
  // No-op if the Vehicle isn't known locally.
  update(vehicleId: string, data: UpdateVehicleData): Promise<void>;
  // Replaces the local Vehicle list with exactly what the API returned,
  // preserving its order. Called by SyncService.pull()'s phase 1 — see ADR
  // 0027's 2026-07-02 update for the phased parent-then-child sequencing.
  // Preserves each Vehicle's already-known detail fields across the
  // replace (falling back to DEFAULT_DETAIL for a Vehicle seen for the
  // first time); phase 2's applyDetail() then refreshes them from the API
  // before pull() returns. This means a Vehicle whose phase-2 fetch fails
  // this cycle keeps last cycle's detail fields rather than losing them —
  // see ADR 0027's 2026-07-03 update.
  reconcile(vehicles: VehicleSummary[]): Promise<void>;
  // Merges Vehicle Detail fields into an already-reconciled row. Called by
  // SyncService.pull()'s phase 2, once per Vehicle.
  applyDetail(vehicleId: string, detail: VehicleDetailFields): Promise<void>;
}

export function createVehicleRepository(
  store: Store<LocalVehicle>,
  outboxWriter: OutboxWriter<LocalVehicle>,
): VehicleRepository {
  async function findRow(id: string): Promise<LocalVehicle | undefined> {
    const [row] = await store.getAll({ where: { id } });
    return row;
  }

  return {
    async findAll(): Promise<VehicleSummary[]> {
      const rows = await store.getAll({ orderBy: { field: 'sortOrder', direction: 'asc' } });
      return rows.map(({ sortOrder: _sortOrder, ...vehicle }) => stripDetail(vehicle));
    },

    async findById(id: string): Promise<LocalVehicleDetail | null> {
      const row = await findRow(id);
      if (!row) return null;
      const { sortOrder: _sortOrder, ...detail } = row;
      return detail;
    },

    async create(data: CreateVehicleData, photo?: PickedPhoto): Promise<string> {
      const id = Crypto.randomUUID();
      // Newly-created Vehicles sort first, matching GET /vehicles' own
      // updatedAt-desc ordering (garage-list-api.md's "sort order proxy") —
      // the next successful sync's reconcile() will re-derive sortOrder
      // from the server's order anyway, so this only governs the brief
      // window before that.
      const existing = await store.getAll();
      const sortOrder = existing.length > 0 ? Math.min(...existing.map((row) => row.sortOrder)) - 1 : 0;
      const vehicle: LocalVehicle = {
        id,
        ...data,
        photoUrl: null,
        logEntryCount: 0,
        ...DEFAULT_DETAIL,
        sortOrder,
      };
      // No local column tracks a pending photo — the reference lives only
      // in this outbox entry's payload until it's uploaded; the next
      // successful sync's applyDetail() picks up the confirmed photoUrl the
      // same way it already does for a Vehicle created without one. See ADR
      // 0027's 2026-07-03 "offline-durable photo upload" update.
      const outboxPayload: Record<string, unknown> = { id, ...data };
      if (photo) outboxPayload.photo = await persistVehiclePhoto(id, photo);
      await outboxWriter.save(vehicle, 'CREATE_VEHICLE', outboxPayload);
      return id;
    },

    async update(vehicleId: string, data: UpdateVehicleData): Promise<void> {
      const row = await findRow(vehicleId);
      if (!row) return;
      const updated: LocalVehicle = { ...row, ...data };
      await outboxWriter.save(updated, 'UPDATE_VEHICLE', { vehicleId, ...data });
    },

    async reconcile(vehicles: VehicleSummary[]): Promise<void> {
      const existing = await store.getAll();
      const existingDetailById = new Map(existing.map((row) => [row.id, extractDetail(row)]));
      await store.replaceAll(
        vehicles.map((vehicle, index) => ({
          ...vehicle,
          ...(existingDetailById.get(vehicle.id) ?? DEFAULT_DETAIL),
          sortOrder: index,
        })),
      );
    },

    async applyDetail(vehicleId: string, detail: VehicleDetailFields): Promise<void> {
      const row = await findRow(vehicleId);
      if (!row) return;
      await store.save({ ...row, ...detail });
    },
  };
}

function stripDetail(vehicle: LocalVehicleDetail): VehicleSummary {
  const { totalSpent: _totalSpent, lastLoggedAt: _lastLoggedAt, transferPending: _transferPending, pendingTransferRecipientEmail: _pendingTransferRecipientEmail, ...summary } = vehicle;
  return summary;
}

function extractDetail(row: LocalVehicleDetail): VehicleDetailFields {
  const { totalSpent, lastLoggedAt, transferPending, pendingTransferRecipientEmail } = row;
  return { totalSpent, lastLoggedAt, transferPending, pendingTransferRecipientEmail };
}
