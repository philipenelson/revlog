import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import type { VehicleSummary } from '@maintenance-log/api-client';
import { useDatabase } from '@/application/providers/DatabaseProvider';
import { useSync } from '@/application/providers/SyncProvider';

export interface GarageViewModel {
  vehicles: VehicleSummary[];
  isLoading: boolean;
  isOffline: boolean;
  pendingCount: number;
  isRefreshing: boolean;
  onRefresh: () => void;
  onAddVehicle: () => void;
  onSelectVehicle: (id: string) => void;
}

export function useGarageViewModel(): GarageViewModel {
  const { vehicleRepository } = useDatabase();
  const { isOnline, pendingCount, syncStatus, lastSyncedAt, refresh } = useSync();
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Re-reads whenever a sync completes (lastSyncedAt changes) — the local
  // table is the only source of truth this screen renders from (ADR 0026).
  useEffect(() => {
    if (!vehicleRepository) return;
    void vehicleRepository.findAll().then(setVehicles);
  }, [vehicleRepository, lastSyncedAt]);

  // UC-MOB-GARAGE-1: a seeded local table renders immediately, no spinner,
  // regardless of sync status. UC-MOB-GARAGE-2: an empty table shows loading
  // only until the first sync attempt concludes (success or failure) —
  // after that, an empty result is a real, renderable empty state.
  const hasCompletedOneSyncAttempt = lastSyncedAt !== null || syncStatus === 'error';
  const isLoading = vehicles.length === 0 && !hasCompletedOneSyncAttempt;

  async function onRefresh(): Promise<void> {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  }

  return {
    vehicles,
    isLoading,
    isOffline: !isOnline,
    pendingCount,
    isRefreshing,
    onRefresh: () => void onRefresh(),
    onAddVehicle: () => router.push('/garage/add'),
    onSelectVehicle: (id: string) => router.push(`/garage/${id}`),
  };
}
