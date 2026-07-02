import type { VehicleSummary } from '@maintenance-log/api-client';
import type { Store } from '@/infrastructure/database/Store';

// Local-only column, never exposed on this repository's public methods —
// preserves GET /vehicles' response order across a local read (see
// infrastructure/database/schema.ts).
type LocalVehicle = VehicleSummary & { sortOrder: number };

export interface VehicleRepository {
  findAll(): Promise<VehicleSummary[]>;
  // Replaces the local Vehicle list with exactly what the API returned,
  // preserving its order. Called by SyncService.pull() — see ADR 0027's
  // 2026-07-02 update for how this sequences against child collections
  // once one exists.
  reconcile(vehicles: VehicleSummary[]): Promise<void>;
}

export function createVehicleRepository(store: Store<LocalVehicle>): VehicleRepository {
  return {
    async findAll(): Promise<VehicleSummary[]> {
      const rows = await store.getAll({ orderBy: { field: 'sortOrder', direction: 'asc' } });
      return rows.map(({ sortOrder: _sortOrder, ...vehicle }) => vehicle);
    },

    async reconcile(vehicles: VehicleSummary[]): Promise<void> {
      await store.replaceAll(vehicles.map((vehicle, index) => ({ ...vehicle, sortOrder: index })));
    },
  };
}
