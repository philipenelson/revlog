import * as Crypto from 'expo-crypto';
import type { VehicleSummary } from '@maintenance-log/api-client';
import type { Store } from '@/domain/ports/Store';
import type { OutboxWriter } from '@/domain/ports/OutboxWriter';
import type { PhotoStore, PickedPhoto } from '@/domain/ports/PhotoStore';

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
  //
  // If `photo` is given (UC-MOB-VEH-6), it's persisted to stable local
  // storage keyed by `vehicleId` — same helper, same reasoning as create()'s
  // `photo` parameter — before the outbox entry is written, and the row's
  // `photoUrl` updates to that stable path immediately. See ADR 0027's
  // 2026-07-04 "offline-durable photo upload extended to Edit Vehicle"
  // update.
  update(vehicleId: string, data: UpdateVehicleData, photo?: PickedPhoto): Promise<void>;
  // UC-MOB-VEH-4: deletes the local row -- cascading to Log Entries via the
  // schema's ON DELETE CASCADE foreign key (infrastructure/database/
  // schema.ts, enforced by openDatabase()'s `PRAGMA foreign_keys = ON`) --
  // and enqueues a DELETE_VEHICLE outbox entry, atomically (OutboxWriter<T>).
  // No-op if the Vehicle isn't known locally.
  delete(vehicleId: string): Promise<void>;
  // UC-MOB-TRANSFER-1: marks the local row transferPending (optimistic lock,
  // ADR 0027) and enqueues an INITIATE_TRANSFER outbox entry, atomically. No
  // client-side "not your own email" check -- see docs/specs/mobile-app/
  // vehicle-transfer.md's Decisions for why that's server-side only on
  // mobile. No-op if the Vehicle isn't known locally.
  initiateTransfer(vehicleId: string, recipientEmail: string): Promise<void>;
  // UC-MOB-TRANSFER-3: clears the local row's transferPending fields and
  // enqueues a CANCEL_TRANSFER outbox entry, atomically. No-op if the
  // Vehicle isn't known locally.
  cancelTransfer(vehicleId: string): Promise<void>;
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
  photoStore: PhotoStore,
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

      // No separate "pending photo" column: the stable local file:// path
      // is stored directly in `photoUrl` (Image renders a local uri exactly
      // like a remote one) so Garage/Vehicle Detail show the picked photo
      // immediately, before the create has even reached the server. Once
      // reconcile() picks up the confirmed row from GET /vehicles, its own
      // `photoUrl` (the real CDN url) naturally overwrites this local one —
      // see ADR 0027's 2026-07-03 "local photo preview" update.
      const stablePhoto = photo ? await photoStore.persist(id, photo) : undefined;
      const vehicle: LocalVehicle = {
        id,
        ...data,
        photoUrl: stablePhoto?.uri ?? null,
        logEntryCount: 0,
        ...DEFAULT_DETAIL,
        sortOrder,
      };
      const outboxPayload: Record<string, unknown> = { id, ...data };
      if (stablePhoto) outboxPayload.photo = stablePhoto;
      await outboxWriter.save(vehicle, 'CREATE_VEHICLE', outboxPayload);
      return id;
    },

    async update(vehicleId: string, data: UpdateVehicleData, photo?: PickedPhoto): Promise<void> {
      const row = await findRow(vehicleId);
      if (!row) return;

      // Same reasoning as create()'s photoUrl handling: the stable local
      // path renders immediately (Image treats file:// like https://), and
      // the next reconcile() overwrites it with the server's confirmed url.
      const stablePhoto = photo ? await photoStore.persist(vehicleId, photo) : undefined;
      const updated: LocalVehicle = { ...row, ...data, ...(stablePhoto ? { photoUrl: stablePhoto.uri } : {}) };
      const outboxPayload: Record<string, unknown> = { vehicleId, ...data };
      if (stablePhoto) outboxPayload.photo = stablePhoto;
      await outboxWriter.save(updated, 'UPDATE_VEHICLE', outboxPayload);
    },

    async delete(vehicleId: string): Promise<void> {
      const row = await findRow(vehicleId);
      if (!row) return;
      // Only ever a local file:// reference for a photo that hasn't synced
      // yet (see create()) -- a reconciled row's real CDN url is left
      // alone, nothing to clean up locally for that case.
      if (row.photoUrl?.startsWith('file://')) photoStore.remove(row.photoUrl);
      await outboxWriter.remove(vehicleId, 'DELETE_VEHICLE', { vehicleId });
    },

    async initiateTransfer(vehicleId: string, recipientEmail: string): Promise<void> {
      const row = await findRow(vehicleId);
      if (!row) return;
      const updated: LocalVehicle = { ...row, transferPending: true, pendingTransferRecipientEmail: recipientEmail };
      await outboxWriter.save(updated, 'INITIATE_TRANSFER', { vehicleId, recipientEmail });
    },

    async cancelTransfer(vehicleId: string): Promise<void> {
      const row = await findRow(vehicleId);
      if (!row) return;
      const updated: LocalVehicle = { ...row, transferPending: false, pendingTransferRecipientEmail: null };
      await outboxWriter.save(updated, 'CANCEL_TRANSFER', { vehicleId });
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
