import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import type { LogEntrySummary } from '@maintenance-log/api-client';
import { useDatabase } from '@/application/providers/DatabaseProvider';
import { useSync } from '@/application/providers/SyncProvider';
import type { LocalVehicleDetail } from '@/domain/repositories/VehicleRepository';
import { formatCurrencyWhole, formatShortDate } from '@/utils/format';

type LoadState = 'loading' | 'not-found' | 'loaded';

export interface VehicleDetailViewModel {
  loadState: LoadState;
  vehicle: LocalVehicleDetail | null;
  logEntries: LogEntrySummary[];
  displayName: string;
  subMeta: string;
  entryCountLabel: string;
  lastLoggedLabel: string;
  totalSpentLabel: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  onBack: () => void;
  onEdit: () => void;
  onShareReport: () => void;
  onAddLogEntry: () => void;
  onSelectLogEntry: (entryId: string) => void;
}

export function useVehicleDetailViewModel(): VehicleDetailViewModel {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const { vehicleRepository, logEntryRepository } = useDatabase();
  const { lastSyncedAt, refresh } = useSync();
  const [vehicle, setVehicle] = useState<LocalVehicleDetail | null>(null);
  const [logEntries, setLogEntries] = useState<LogEntrySummary[]>([]);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Re-reads whenever a sync completes (lastSyncedAt changes) — the local
  // tables are the only source this screen renders from (ADR 0026), same as
  // useGarageViewModel.
  useEffect(() => {
    if (!vehicleRepository || !logEntryRepository || !vehicleId) return;
    void Promise.all([vehicleRepository.findById(vehicleId), logEntryRepository.findByVehicleId(vehicleId)]).then(
      ([foundVehicle, entries]) => {
        setVehicle(foundVehicle);
        setLogEntries(entries);
        setHasLoadedOnce(true);
      },
    );
  }, [vehicleRepository, logEntryRepository, vehicleId, lastSyncedAt]);

  async function onRefresh(): Promise<void> {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  }

  const loadState: LoadState = !hasLoadedOnce ? 'loading' : vehicle ? 'loaded' : 'not-found';

  const displayName = vehicle ? (vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`) : '';
  const subMeta = vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model} · ${vehicle.mileage.toLocaleString()} mi` : '';

  const entryCountLabel = logEntries.length > 0 ? String(logEntries.length) : 'None';
  const lastLoggedLabel = vehicle?.lastLoggedAt ? formatShortDate(vehicle.lastLoggedAt) : 'Never';
  const totalSpent = vehicle?.totalSpent ? parseFloat(vehicle.totalSpent) : 0;
  const totalSpentLabel = totalSpent > 0 ? formatCurrencyWhole(totalSpent) : '—';

  return {
    loadState,
    vehicle,
    logEntries,
    displayName,
    subMeta,
    entryCountLabel,
    lastLoggedLabel,
    totalSpentLabel,
    isRefreshing,
    onRefresh: () => void onRefresh(),
    onBack: () => router.back(),
    onEdit: () => router.push(`/garage/${vehicleId}/edit`),
    onShareReport: () => router.push(`/garage/${vehicleId}/report`),
    onAddLogEntry: () => router.push(`/garage/${vehicleId}/log/new`),
    onSelectLogEntry: (entryId: string) => router.push(`/garage/${vehicleId}/log/${entryId}`),
  };
}
