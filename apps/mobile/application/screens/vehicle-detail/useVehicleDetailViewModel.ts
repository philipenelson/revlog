import { useCallback, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
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
  // UC-MOB-VEH-4 / UC-MOB-TRANSFER-1 — the header `[⋮]` menu, offering
  // Transfer vehicle and Delete vehicle (see docs/specs/mobile-app/
  // vehicle.md's Decisions for why these two share a menu instead of
  // getting their own header icons).
  menuOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;
  onTransfer: () => void;
  // UC-MOB-VEH-4 — delete confirmation. Moved here from Edit Vehicle's
  // former danger zone; same dialog copy and handleDelete behaviour.
  deleteDialogOpen: boolean;
  openDeleteDialog: () => void;
  closeDeleteDialog: () => void;
  isDeleting: boolean;
  deleteError: string | null;
  handleDelete: () => void;
  // UC-MOB-TRANSFER-3 — cancel a pending transfer. No navigation on
  // success: the screen re-reads the vehicle in place so it unlocks
  // immediately, without waiting for sync.
  cancelTransferDialogOpen: boolean;
  openCancelTransferDialog: () => void;
  closeCancelTransferDialog: () => void;
  isCancellingTransfer: boolean;
  cancelTransferError: string | null;
  handleCancelTransfer: () => void;
}

export function useVehicleDetailViewModel(): VehicleDetailViewModel {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const { vehicleRepository, logEntryRepository } = useDatabase();
  const { lastSyncedAt, refresh } = useSync();
  const [vehicle, setVehicle] = useState<LocalVehicleDetail | null>(null);
  const [logEntries, setLogEntries] = useState<LogEntrySummary[]>([]);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [cancelTransferDialogOpen, setCancelTransferDialogOpen] = useState(false);
  const [isCancellingTransfer, setIsCancellingTransfer] = useState(false);
  const [cancelTransferError, setCancelTransferError] = useState<string | null>(null);

  // Re-reads whenever a sync completes (lastSyncedAt changes) — the local
  // tables are the only source this screen renders from (ADR 0026), same as
  // useGarageViewModel. useFocusEffect, not useEffect: native-stack doesn't
  // remount a screen on router.back() (it reveals the same instance), so a
  // plain mount-effect would keep showing pre-edit data after Edit Vehicle
  // saves and backs out. Refetching on every focus picks up local writes
  // made while this screen was hidden, with no dependency on lastSyncedAt
  // (a background-sync concept) having changed at all.
  useFocusEffect(
    useCallback(() => {
      if (!vehicleRepository || !logEntryRepository || !vehicleId) return;
      void Promise.all([vehicleRepository.findById(vehicleId), logEntryRepository.findByVehicleId(vehicleId)]).then(
        ([foundVehicle, entries]) => {
          setVehicle(foundVehicle);
          setLogEntries(entries);
          setHasLoadedOnce(true);
        },
      );
    }, [vehicleRepository, logEntryRepository, vehicleId, lastSyncedAt]),
  );

  async function onRefresh(): Promise<void> {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  }

  function openDeleteDialog(): void {
    setMenuOpen(false);
    setDeleteError(null);
    setDeleteDialogOpen(true);
  }

  function closeDeleteDialog(): void {
    if (isDeleting) return;
    setDeleteDialogOpen(false);
    setDeleteError(null);
  }

  async function handleDeleteConfirm(): Promise<void> {
    if (!vehicleRepository || !vehicleId) return;

    setDeleteError(null);
    setIsDeleting(true);
    try {
      await vehicleRepository.delete(vehicleId);
      // dismissTo(), not back() -- pops this Vehicle Detail screen off the
      // stack, landing on the existing Garage instance underneath, same
      // reasoning as Edit Vehicle's former delete handler used.
      router.dismissTo('/garage');
    } catch {
      setDeleteError("Couldn't delete this vehicle. Try again in a moment.");
    } finally {
      setIsDeleting(false);
    }
  }

  function openCancelTransferDialog(): void {
    setCancelTransferError(null);
    setCancelTransferDialogOpen(true);
  }

  function closeCancelTransferDialog(): void {
    if (isCancellingTransfer) return;
    setCancelTransferDialogOpen(false);
    setCancelTransferError(null);
  }

  async function handleCancelTransferConfirm(): Promise<void> {
    if (!vehicleRepository || !vehicleId) return;

    setCancelTransferError(null);
    setIsCancellingTransfer(true);
    try {
      await vehicleRepository.cancelTransfer(vehicleId);
      // No navigation for cancel (unlike delete) -- re-read the just-updated
      // local row so the screen unlocks immediately, without waiting for a
      // sync round trip.
      const updated = await vehicleRepository.findById(vehicleId);
      setVehicle(updated);
      setCancelTransferDialogOpen(false);
    } catch {
      setCancelTransferError("Couldn't cancel the transfer. Try again in a moment.");
    } finally {
      setIsCancellingTransfer(false);
    }
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
    menuOpen,
    openMenu: () => setMenuOpen(true),
    closeMenu: () => setMenuOpen(false),
    onTransfer: () => {
      setMenuOpen(false);
      router.push(`/garage/${vehicleId}/transfer`);
    },
    deleteDialogOpen,
    openDeleteDialog,
    closeDeleteDialog,
    isDeleting,
    deleteError,
    handleDelete: () => void handleDeleteConfirm(),
    cancelTransferDialogOpen,
    openCancelTransferDialog,
    closeCancelTransferDialog,
    isCancellingTransfer,
    cancelTransferError,
    handleCancelTransfer: () => void handleCancelTransferConfirm(),
  };
}
