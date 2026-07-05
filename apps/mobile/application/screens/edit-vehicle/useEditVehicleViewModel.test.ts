import { act, renderHook, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { LocalVehicleDetail } from '@/domain/repositories/VehicleRepository';
import { useEditVehicleViewModel } from './useEditVehicleViewModel';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({ vehicleId: 'v1' })),
}));
jest.mock('@/application/providers/DatabaseProvider', () => ({ useDatabase: jest.fn() }));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

import { useDatabase } from '@/application/providers/DatabaseProvider';
import * as ImagePicker from 'expo-image-picker';

const mockUseDatabase = useDatabase as jest.MockedFunction<typeof useDatabase>;
const mockPush = router.push as jest.Mock;
const mockBack = router.back as jest.Mock;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockRequestPermissions = ImagePicker.requestMediaLibraryPermissionsAsync as jest.MockedFunction<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockLaunchLibrary = ImagePicker.launchImageLibraryAsync as jest.MockedFunction<any>;

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
  return { update };
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

    expect(update).toHaveBeenCalledWith(
      'v1',
      {
        nickname: 'Blackbird',
        make: 'Honda',
        model: 'CB650R',
        year: 2019,
        mileage: 5000,
      },
      undefined,
    );
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

    expect(update).toHaveBeenCalledWith('v1', expect.objectContaining({ mileage: 12500 }), undefined);
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

  it('photoPreviewUri starts as the loaded vehicle\'s saved photo, with no pending pick', async () => {
    setDatabase({ ...vehicle, photoUrl: 'https://cdn.example.com/v1.jpg' });

    const { result } = await renderHook(() => useEditVehicleViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    expect(result.current.photoPreviewUri).toBe('https://cdn.example.com/v1.jpg');
    expect(result.current.hasPendingPhotoPick).toBe(false);
  });

  it('pickPhoto sets a photo error and no preview change when library permission is denied', async () => {
    setDatabase(vehicle);
    mockRequestPermissions.mockResolvedValue({ granted: false });

    const { result } = await renderHook(() => useEditVehicleViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));
    await act(async () => {
      result.current.pickPhoto();
    });

    expect(result.current.photoError).toBe('Enable photo access in Settings to change this vehicle\'s picture.');
    expect(result.current.hasPendingPhotoPick).toBe(false);
    expect(mockLaunchLibrary).not.toHaveBeenCalled();
  });

  it('pickPhoto shows the picked asset as a pending preview', async () => {
    setDatabase(vehicle);
    mockRequestPermissions.mockResolvedValue({ granted: true });
    mockLaunchLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/picker-cache/abc.jpg', fileName: 'IMG_0001.jpg', mimeType: 'image/jpeg' }],
    });

    const { result } = await renderHook(() => useEditVehicleViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));
    await act(async () => {
      result.current.pickPhoto();
    });

    expect(result.current.photoPreviewUri).toBe('file:///tmp/picker-cache/abc.jpg');
    expect(result.current.hasPendingPhotoPick).toBe(true);
    expect(result.current.photoError).toBeNull();
  });

  it('removePhoto discards the pending pick and reverts to the saved photo', async () => {
    setDatabase({ ...vehicle, photoUrl: 'https://cdn.example.com/v1.jpg' });
    mockRequestPermissions.mockResolvedValue({ granted: true });
    mockLaunchLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/picker-cache/abc.jpg', fileName: 'IMG_0001.jpg', mimeType: 'image/jpeg' }],
    });

    const { result } = await renderHook(() => useEditVehicleViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));
    await act(async () => {
      result.current.pickPhoto();
    });
    expect(result.current.hasPendingPhotoPick).toBe(true);

    await act(async () => {
      result.current.removePhoto();
    });

    expect(result.current.photoPreviewUri).toBe('https://cdn.example.com/v1.jpg');
    expect(result.current.hasPendingPhotoPick).toBe(false);
    expect(result.current.photoError).toBeNull();
  });

  it('submit passes the picked photo through to vehicleRepository.update', async () => {
    const { update } = setDatabase(vehicle);
    mockRequestPermissions.mockResolvedValue({ granted: true });
    mockLaunchLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/picker-cache/abc.jpg', fileName: 'IMG_0001.jpg', mimeType: 'image/jpeg' }],
    });

    const { result } = await renderHook(() => useEditVehicleViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));
    await act(async () => {
      result.current.pickPhoto();
    });
    await act(async () => {
      result.current.submit();
    });

    expect(update).toHaveBeenCalledWith('v1', expect.objectContaining({ make: 'Honda' }), {
      uri: 'file:///tmp/picker-cache/abc.jpg',
      name: 'IMG_0001.jpg',
      type: 'image/jpeg',
    });
  });

  it('submit does not pass a photo when none was picked', async () => {
    const { update } = setDatabase(vehicle);

    const { result } = await renderHook(() => useEditVehicleViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));
    await act(async () => {
      result.current.submit();
    });

    expect(update).toHaveBeenCalledWith('v1', expect.anything(), undefined);
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
});
