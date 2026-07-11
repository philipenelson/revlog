import { act, renderHook, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { LogEntrySummary } from '@maintenance-log/api-client';
import type { LocalVehicleDetail } from '@/domain/repositories/VehicleRepository';
import { useVehicleDetailViewModel, deriveDetailLoadState, entryCountText } from './useVehicleDetailViewModel';

// useFocusEffect stands in for a plain useEffect here: the test renderer has
// no navigation container to actually gain/lose focus, and the real
// implementation's contract ("re-run when the memoized callback changes")
// is exactly what useEffect already gives us for a jest.fn()-free callback.
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    router: { push: jest.fn(), back: jest.fn(), dismissTo: jest.fn() },
    useLocalSearchParams: jest.fn(() => ({ vehicleId: 'v1' })),
    useFocusEffect: (effect: () => void) => useEffect(effect),
  };
});
jest.mock('@/application/providers/DatabaseProvider', () => ({ useDatabase: jest.fn() }));
jest.mock('@/application/providers/SyncProvider', () => ({ useSync: jest.fn() }));

import { useDatabase } from '@/application/providers/DatabaseProvider';
import { useSync } from '@/application/providers/SyncProvider';

const mockUseDatabase = useDatabase as jest.MockedFunction<typeof useDatabase>;
const mockUseSync = useSync as jest.MockedFunction<typeof useSync>;
const mockPush = router.push as jest.Mock;
const mockBack = router.back as jest.Mock;
const mockDismissTo = router.dismissTo as jest.Mock;

const vehicle: LocalVehicleDetail = {
  id: 'v1',
  nickname: 'Blackbird',
  make: 'Honda',
  model: 'CB650R',
  year: 2019,
  mileage: 4200,
  photoUrl: null,
  logEntryCount: 1,
  totalSpent: '1840.00',
  lastLoggedAt: '2026-06-28',
  transferPending: false,
  pendingTransferRecipientEmail: null,
};

const entry: LogEntrySummary = {
  id: 'e1',
  typeId: 'MAINTENANCE',
  title: 'Oil & filter change',
  date: '2026-06-28',
  time: null,
  mileage: 12400,
  itemCount: 3,
  mediaCount: 2,
  totalCost: '85.00',
};

function setDatabase(
  foundVehicle: LocalVehicleDetail | null,
  entries: LogEntrySummary[] = [],
  overrides: { deleteImpl?: () => Promise<void>; cancelTransferImpl?: () => Promise<void> } = {},
) {
  const findById = jest.fn(async () => foundVehicle);
  const del = jest.fn(overrides.deleteImpl ?? (async () => {}));
  const cancelTransfer = jest.fn(overrides.cancelTransferImpl ?? (async () => {}));
  mockUseDatabase.mockReturnValue({
    isReady: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vehicleRepository: { findById, delete: del, cancelTransfer } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    outboxRepository: {} as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logEntryRepository: { findByVehicleId: jest.fn(async () => entries) } as any,
  });
  return { findById, delete: del, cancelTransfer };
}

function setSync(overrides: Partial<ReturnType<typeof useSync>> = {}) {
  mockUseSync.mockReturnValue({
    isOnline: true,
    pendingCount: 0,
    syncStatus: 'idle',
    lastSyncedAt: null,
    refresh: jest.fn(async () => {}),
    ...overrides,
  });
}

describe('useVehicleDetailViewModel', () => {
  afterEach(() => jest.clearAllMocks());

  it('is loading until the local read resolves', async () => {
    setDatabase(vehicle, [entry]);
    setSync();

    const { result } = await renderHook(() => useVehicleDetailViewModel());

    await waitFor(() => expect(result.current.loadState).toBe('loaded'));
  });

  it('renders the vehicle and its log entries once loaded', async () => {
    setDatabase(vehicle, [entry]);
    setSync();

    const { result } = await renderHook(() => useVehicleDetailViewModel());

    await waitFor(() => expect(result.current.loadState).toBe('loaded'));
    expect(result.current.displayName).toBe('Blackbird');
    expect(result.current.subMeta).toBe('2019 Honda CB650R · 4,200 mi');
    expect(result.current.entryCountLabel).toBe('1');
    expect(result.current.lastLoggedLabel).toBe('Jun 28, 2026');
    expect(result.current.totalSpentLabel).toBe('$1,840');
    expect(result.current.logEntries).toEqual([entry]);
  });

  it('shows not-found when the vehicle does not exist locally', async () => {
    setDatabase(null);
    setSync();

    const { result } = await renderHook(() => useVehicleDetailViewModel());

    await waitFor(() => expect(result.current.loadState).toBe('not-found'));
  });

  it('defaults entry count/last logged/total spent for a vehicle with no entries or detail sync yet', async () => {
    setDatabase({ ...vehicle, totalSpent: null, lastLoggedAt: null }, []);
    setSync();

    const { result } = await renderHook(() => useVehicleDetailViewModel());

    await waitFor(() => expect(result.current.loadState).toBe('loaded'));
    expect(result.current.entryCountLabel).toBe('None');
    expect(result.current.lastLoggedLabel).toBe('Never');
    expect(result.current.totalSpentLabel).toBe('—');
  });

  it('onBack navigates back to Garage', async () => {
    setDatabase(vehicle);
    setSync();

    const { result } = await renderHook(() => useVehicleDetailViewModel());
    result.current.onBack();

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('onEdit, onShareReport, onAddLogEntry, and onSelectLogEntry navigate to the right routes', async () => {
    setDatabase(vehicle);
    setSync();

    const { result } = await renderHook(() => useVehicleDetailViewModel());
    result.current.onEdit();
    result.current.onShareReport();
    result.current.onAddLogEntry();
    result.current.onSelectLogEntry('e1');

    expect(mockPush).toHaveBeenCalledWith('/garage/v1/edit');
    expect(mockPush).toHaveBeenCalledWith('/garage/v1/report');
    expect(mockPush).toHaveBeenCalledWith('/garage/v1/log/new');
    expect(mockPush).toHaveBeenCalledWith('/garage/v1/log/e1');
  });

  it('onRefresh delegates to SyncProvider.refresh and toggles isRefreshing', async () => {
    setDatabase(vehicle);
    const refresh = jest.fn(async () => {});
    setSync({ refresh });

    const { result } = await renderHook(() => useVehicleDetailViewModel());

    await act(async () => {
      result.current.onRefresh();
      await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    });

    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
  });

  it('openMenu/closeMenu toggle menuOpen', async () => {
    setDatabase(vehicle);
    setSync();

    const { result } = await renderHook(() => useVehicleDetailViewModel());

    await act(async () => {
      result.current.openMenu();
    });
    expect(result.current.menuOpen).toBe(true);

    await act(async () => {
      result.current.closeMenu();
    });
    expect(result.current.menuOpen).toBe(false);
  });

  it('onTransfer closes the menu and navigates to the transfer screen', async () => {
    setDatabase(vehicle);
    setSync();

    const { result } = await renderHook(() => useVehicleDetailViewModel());
    await act(async () => {
      result.current.openMenu();
    });

    await act(async () => {
      result.current.onTransfer();
    });

    expect(result.current.menuOpen).toBe(false);
    expect(mockPush).toHaveBeenCalledWith('/garage/v1/transfer');
  });

  it('openDeleteDialog closes the menu and opens deleteDialogOpen; closeDeleteDialog closes it', async () => {
    setDatabase(vehicle);
    setSync();

    const { result } = await renderHook(() => useVehicleDetailViewModel());
    await act(async () => {
      result.current.openMenu();
    });

    await act(async () => {
      result.current.openDeleteDialog();
    });
    expect(result.current.menuOpen).toBe(false);
    expect(result.current.deleteDialogOpen).toBe(true);

    await act(async () => {
      result.current.closeDeleteDialog();
    });
    expect(result.current.deleteDialogOpen).toBe(false);
  });

  it('deletes via vehicleRepository.delete and dismisses back to Garage on success', async () => {
    const { delete: del } = setDatabase(vehicle);
    setSync();

    const { result } = await renderHook(() => useVehicleDetailViewModel());
    await act(async () => {
      result.current.openDeleteDialog();
    });
    await act(async () => {
      result.current.handleDelete();
    });

    expect(del).toHaveBeenCalledWith('v1');
    expect(mockDismissTo).toHaveBeenCalledWith('/garage');
  });

  it('shows a delete error and keeps the dialog open when the local delete throws', async () => {
    setDatabase(vehicle, [], {
      deleteImpl: async () => {
        throw new Error('disk full');
      },
    });
    setSync();

    const { result } = await renderHook(() => useVehicleDetailViewModel());
    await act(async () => {
      result.current.openDeleteDialog();
    });
    await act(async () => {
      result.current.handleDelete();
    });

    expect(result.current.deleteError).toBe("Couldn't delete this vehicle. Try again in a moment.");
    expect(result.current.deleteDialogOpen).toBe(true);
    expect(mockDismissTo).not.toHaveBeenCalled();
  });

  it('openCancelTransferDialog/closeCancelTransferDialog toggle cancelTransferDialogOpen', async () => {
    setDatabase({ ...vehicle, transferPending: true, pendingTransferRecipientEmail: 'buyer@example.com' });
    setSync();

    const { result } = await renderHook(() => useVehicleDetailViewModel());

    await act(async () => {
      result.current.openCancelTransferDialog();
    });
    expect(result.current.cancelTransferDialogOpen).toBe(true);

    await act(async () => {
      result.current.closeCancelTransferDialog();
    });
    expect(result.current.cancelTransferDialogOpen).toBe(false);
  });

  it('cancels the transfer, re-reads the vehicle, and closes the dialog on success', async () => {
    const lockedVehicle = { ...vehicle, transferPending: true, pendingTransferRecipientEmail: 'buyer@example.com' };
    const { findById, cancelTransfer } = setDatabase(lockedVehicle);
    setSync();

    const { result } = await renderHook(() => useVehicleDetailViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('loaded'));

    findById.mockResolvedValue({ ...vehicle, transferPending: false, pendingTransferRecipientEmail: null });
    await act(async () => {
      result.current.openCancelTransferDialog();
    });
    await act(async () => {
      result.current.handleCancelTransfer();
    });

    expect(cancelTransfer).toHaveBeenCalledWith('v1');
    expect(result.current.vehicle?.transferPending).toBe(false);
    expect(result.current.cancelTransferDialogOpen).toBe(false);
  });

  it('shows a cancel-transfer error and keeps the dialog open when the local write throws', async () => {
    const lockedVehicle = { ...vehicle, transferPending: true, pendingTransferRecipientEmail: 'buyer@example.com' };
    setDatabase(lockedVehicle, [], {
      cancelTransferImpl: async () => {
        throw new Error('disk full');
      },
    });
    setSync();

    const { result } = await renderHook(() => useVehicleDetailViewModel());
    await act(async () => {
      result.current.openCancelTransferDialog();
    });
    await act(async () => {
      result.current.handleCancelTransfer();
    });

    expect(result.current.cancelTransferError).toBe("Couldn't cancel the transfer. Try again in a moment.");
    expect(result.current.cancelTransferDialogOpen).toBe(true);
  });
});

describe('vehicle-detail pure logic', () => {
  describe('deriveDetailLoadState', () => {
    it('is loading until the first read completes', () => {
      expect(deriveDetailLoadState(false, false)).toBe('loading');
      expect(deriveDetailLoadState(false, true)).toBe('loading');
    });
    it('is loaded/not-found once read, by presence of the vehicle', () => {
      expect(deriveDetailLoadState(true, true)).toBe('loaded');
      expect(deriveDetailLoadState(true, false)).toBe('not-found');
    });
  });
  describe('entryCountText', () => {
    it('shows the count, or None when empty', () => {
      expect(entryCountText(3)).toBe('3');
      expect(entryCountText(0)).toBe('None');
    });
  });
});
