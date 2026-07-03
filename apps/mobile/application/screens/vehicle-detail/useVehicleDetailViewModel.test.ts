import { act, renderHook, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { LogEntrySummary } from '@maintenance-log/api-client';
import type { LocalVehicleDetail } from '@/domain/repositories/VehicleRepository';
import { useVehicleDetailViewModel } from './useVehicleDetailViewModel';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({ vehicleId: 'v1' })),
}));
jest.mock('@/application/providers/DatabaseProvider', () => ({ useDatabase: jest.fn() }));
jest.mock('@/application/providers/SyncProvider', () => ({ useSync: jest.fn() }));

import { useDatabase } from '@/application/providers/DatabaseProvider';
import { useSync } from '@/application/providers/SyncProvider';

const mockUseDatabase = useDatabase as jest.MockedFunction<typeof useDatabase>;
const mockUseSync = useSync as jest.MockedFunction<typeof useSync>;
const mockPush = router.push as jest.Mock;
const mockBack = router.back as jest.Mock;

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

function setDatabase(foundVehicle: LocalVehicleDetail | null, entries: LogEntrySummary[] = []) {
  mockUseDatabase.mockReturnValue({
    isReady: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vehicleRepository: { findById: jest.fn(async () => foundVehicle) } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    outboxRepository: {} as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logEntryRepository: { findByVehicleId: jest.fn(async () => entries) } as any,
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
});
