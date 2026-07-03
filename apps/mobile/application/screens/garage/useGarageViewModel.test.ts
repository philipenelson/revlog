import { act, renderHook, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { VehicleSummary } from '@maintenance-log/api-client';
import { useGarageViewModel } from './useGarageViewModel';

// useFocusEffect stands in for a plain useEffect here: the test renderer has
// no navigation container to actually gain/lose focus, and the real
// implementation's contract ("re-run when the memoized callback changes")
// is exactly what useEffect already gives us for a jest.fn()-free callback.
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    router: { push: jest.fn() },
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

const vehicle: VehicleSummary = {
  id: 'v1',
  nickname: 'Blackbird',
  make: 'Honda',
  model: 'CB650R',
  year: 2019,
  mileage: 4200,
  photoUrl: null,
  logEntryCount: 14,
};

function setDatabase(vehicles: VehicleSummary[]) {
  mockUseDatabase.mockReturnValue({
    isReady: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vehicleRepository: { findAll: jest.fn(async () => vehicles), reconcile: jest.fn() } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    outboxRepository: {} as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logEntryRepository: {} as any,
  });
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

describe('useGarageViewModel', () => {
  afterEach(() => jest.clearAllMocks());

  it('is loading when the local table is empty and no sync attempt has concluded', async () => {
    setDatabase([]);
    setSync({ lastSyncedAt: null, syncStatus: 'syncing' });

    const { result } = await renderHook(() => useGarageViewModel());

    expect(result.current.isLoading).toBe(true);
  });

  it('renders immediately from a seeded local table, even mid-sync', async () => {
    setDatabase([vehicle]);
    setSync({ lastSyncedAt: null, syncStatus: 'syncing' });

    const { result } = await renderHook(() => useGarageViewModel());

    await waitFor(() => expect(result.current.vehicles).toEqual([vehicle]));
    expect(result.current.isLoading).toBe(false);
  });

  it('stops loading once a first sync attempt concludes, even with zero vehicles', async () => {
    setDatabase([]);
    setSync({ lastSyncedAt: new Date() });

    const { result } = await renderHook(() => useGarageViewModel());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.vehicles).toEqual([]);
  });

  it('stops loading after a failed first sync attempt', async () => {
    setDatabase([]);
    setSync({ lastSyncedAt: null, syncStatus: 'error' });

    const { result } = await renderHook(() => useGarageViewModel());

    expect(result.current.isLoading).toBe(false);
  });

  it('reflects offline state from SyncProvider', async () => {
    setDatabase([]);
    setSync({ isOnline: false, pendingCount: 2 });

    const { result } = await renderHook(() => useGarageViewModel());

    expect(result.current.isOffline).toBe(true);
    expect(result.current.pendingCount).toBe(2);
  });

  it('onRefresh delegates to SyncProvider.refresh and toggles isRefreshing', async () => {
    setDatabase([]);
    const refresh = jest.fn(async () => {});
    setSync({ refresh });

    const { result } = await renderHook(() => useGarageViewModel());

    await act(async () => {
      result.current.onRefresh();
      await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    });

    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
  });

  it('onAddVehicle navigates to /garage/add', async () => {
    setDatabase([]);
    setSync();

    const { result } = await renderHook(() => useGarageViewModel());
    result.current.onAddVehicle();

    expect(mockPush).toHaveBeenCalledWith('/garage/add');
  });

  it('onSelectVehicle navigates to /garage/[id]', async () => {
    setDatabase([]);
    setSync();

    const { result } = await renderHook(() => useGarageViewModel());
    result.current.onSelectVehicle('v1');

    expect(mockPush).toHaveBeenCalledWith('/garage/v1');
  });
});
