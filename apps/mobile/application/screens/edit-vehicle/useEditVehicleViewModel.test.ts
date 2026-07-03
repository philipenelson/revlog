import { act, renderHook, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { LocalVehicleDetail } from '@/domain/repositories/VehicleRepository';
import { useEditVehicleViewModel } from './useEditVehicleViewModel';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({ vehicleId: 'v1' })),
}));
jest.mock('@/application/providers/DatabaseProvider', () => ({ useDatabase: jest.fn() }));

import { useDatabase } from '@/application/providers/DatabaseProvider';

const mockUseDatabase = useDatabase as jest.MockedFunction<typeof useDatabase>;
const mockPush = router.push as jest.Mock;

const vehicle: LocalVehicleDetail = {
  id: 'v1',
  nickname: 'Blackbird',
  make: 'Honda',
  model: 'CB650R',
  year: 2019,
  mileage: 4200,
  photoUrl: null,
  logEntryCount: 1,
  totalSpent: null,
  lastLoggedAt: null,
  transferPending: false,
  pendingTransferRecipientEmail: null,
};

function setDatabase(foundVehicle: LocalVehicleDetail | null, updateImpl?: () => Promise<void>) {
  const update = jest.fn(updateImpl ?? (async () => {}));
  mockUseDatabase.mockReturnValue({
    isReady: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vehicleRepository: { findById: jest.fn(async () => foundVehicle), update } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    outboxRepository: {} as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logEntryRepository: {} as any,
  });
  return update;
}

describe('useEditVehicleViewModel', () => {
  afterEach(() => jest.clearAllMocks());

  it('pre-fills the form from the local vehicle once loaded', async () => {
    setDatabase(vehicle);

    const { result } = await renderHook(() => useEditVehicleViewModel());

    await waitFor(() => expect(result.current.loadState).toBe('ready'));
    expect(result.current.fields).toEqual({
      nickname: 'Blackbird',
      make: 'Honda',
      model: 'CB650R',
      year: '2019',
      mileage: '4200',
    });
    expect(result.current.vehicleDisplayName).toBe('Blackbird');
  });

  it('shows not-found when the vehicle does not exist locally', async () => {
    setDatabase(null);

    const { result } = await renderHook(() => useEditVehicleViewModel());

    await waitFor(() => expect(result.current.loadState).toBe('not-found'));
  });

  it('blocks submission and surfaces field errors when required fields are invalid', async () => {
    setDatabase({ ...vehicle, make: '' });

    const { result } = await renderHook(() => useEditVehicleViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    await act(async () => {
      result.current.submit();
    });

    expect(result.current.errors.make).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('clears a field error as soon as that field is edited', async () => {
    setDatabase({ ...vehicle, make: '' });

    const { result } = await renderHook(() => useEditVehicleViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    await act(async () => {
      result.current.submit();
    });
    expect(result.current.errors.make).toBeTruthy();

    await act(async () => {
      result.current.updateField('make', 'Honda');
    });

    expect(result.current.errors.make).toBeUndefined();
  });

  it('saves via vehicleRepository.update and navigates to Vehicle Detail on success', async () => {
    const update = setDatabase(vehicle);

    const { result } = await renderHook(() => useEditVehicleViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    await act(async () => {
      result.current.updateField('mileage', '5000');
    });
    await act(async () => {
      result.current.submit();
    });

    expect(update).toHaveBeenCalledWith('v1', {
      nickname: 'Blackbird',
      make: 'Honda',
      model: 'CB650R',
      year: 2019,
      mileage: 5000,
    });
    expect(mockPush).toHaveBeenCalledWith('/garage/v1');
  });

  it('strips commas from mileage before validating and saving', async () => {
    const update = setDatabase(vehicle);

    const { result } = await renderHook(() => useEditVehicleViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    await act(async () => {
      result.current.updateField('mileage', '12,500');
    });
    await act(async () => {
      result.current.submit();
    });

    expect(update).toHaveBeenCalledWith('v1', expect.objectContaining({ mileage: 12500 }));
  });

  it('shows a submit error and does not navigate when the local write throws', async () => {
    setDatabase(vehicle, async () => {
      throw new Error('disk full');
    });

    const { result } = await renderHook(() => useEditVehicleViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    await act(async () => {
      result.current.submit();
    });

    expect(result.current.submitError).toBe("Couldn't save changes. Try again in a moment.");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('onCancel and onBackToGarage navigate to the right routes', async () => {
    setDatabase(vehicle);

    const { result } = await renderHook(() => useEditVehicleViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    result.current.onCancel();
    result.current.onBackToGarage();

    expect(mockPush).toHaveBeenCalledWith('/garage/v1');
    expect(mockPush).toHaveBeenCalledWith('/garage');
  });
});
