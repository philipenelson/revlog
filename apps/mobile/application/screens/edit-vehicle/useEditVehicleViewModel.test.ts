import { act, renderHook, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { LocalVehicleDetail } from '@/domain/repositories/VehicleRepository';
import { useEditVehicleViewModel } from './useEditVehicleViewModel';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), dismissTo: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({ vehicleId: 'v1' })),
}));
jest.mock('@/application/providers/DatabaseProvider', () => ({ useDatabase: jest.fn() }));

import { useDatabase } from '@/application/providers/DatabaseProvider';

const mockUseDatabase = useDatabase as jest.MockedFunction<typeof useDatabase>;
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
  totalSpent: null,
  lastLoggedAt: null,
  transferPending: false,
  pendingTransferRecipientEmail: null,
};

function setDatabase(
  foundVehicle: LocalVehicleDetail | null,
  updateImpl?: () => Promise<void>,
  deleteImpl?: () => Promise<void>,
) {
  const update = jest.fn(updateImpl ?? (async () => {}));
  const del = jest.fn(deleteImpl ?? (async () => {}));
  mockUseDatabase.mockReturnValue({
    isReady: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vehicleRepository: { findById: jest.fn(async () => foundVehicle), update, delete: del } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    outboxRepository: {} as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logEntryRepository: {} as any,
  });
  return { update, delete: del };
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
    expect(mockBack).not.toHaveBeenCalled();
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

  it('saves via vehicleRepository.update and navigates back to Vehicle Detail on success', async () => {
    const { update } = setDatabase(vehicle);

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
    // back(), not push() -- Edit was reached by pushing from Vehicle Detail,
    // so pushing the same route again would stack a second instance instead
    // of returning to the one already on the stack.
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('strips commas from mileage before validating and saving', async () => {
    const { update } = setDatabase(vehicle);

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
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('onCancel navigates back; onBackToGarage pushes /garage', async () => {
    setDatabase(vehicle);

    const { result } = await renderHook(() => useEditVehicleViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    result.current.onCancel();
    result.current.onBackToGarage();

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/garage');
  });

  it('openDeleteDialog/closeDeleteDialog toggle deleteDialogOpen and clear any prior error', async () => {
    setDatabase(vehicle);

    const { result } = await renderHook(() => useEditVehicleViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    await act(async () => {
      result.current.openDeleteDialog();
    });
    expect(result.current.deleteDialogOpen).toBe(true);

    await act(async () => {
      result.current.closeDeleteDialog();
    });
    expect(result.current.deleteDialogOpen).toBe(false);
  });

  it('deletes via vehicleRepository.delete and dismisses back to Garage on success', async () => {
    const { delete: del } = setDatabase(vehicle);

    const { result } = await renderHook(() => useEditVehicleViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    await act(async () => {
      result.current.openDeleteDialog();
    });
    await act(async () => {
      result.current.handleDelete();
    });

    expect(del).toHaveBeenCalledWith('v1');
    // dismissTo(), not back() -- pops both Vehicle Detail and this Edit
    // screen off the stack so the deleted vehicle's Detail screen isn't
    // left reachable via a back navigation from Garage.
    expect(mockDismissTo).toHaveBeenCalledWith('/garage');
  });

  it('shows a delete error and keeps the dialog open when the local delete throws', async () => {
    setDatabase(vehicle, undefined, async () => {
      throw new Error('disk full');
    });

    const { result } = await renderHook(() => useEditVehicleViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

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

  it('closeDeleteDialog is a no-op while a delete is in flight', async () => {
    let resolveDelete!: () => void;
    setDatabase(
      vehicle,
      undefined,
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        }),
    );

    const { result } = await renderHook(() => useEditVehicleViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    await act(async () => {
      result.current.openDeleteDialog();
    });
    await act(async () => {
      result.current.handleDelete();
    });
    await waitFor(() => expect(result.current.isDeleting).toBe(true));

    await act(async () => {
      result.current.closeDeleteDialog();
    });
    expect(result.current.deleteDialogOpen).toBe(true);

    await act(async () => resolveDelete());
  });
});
