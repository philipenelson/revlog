import { act, renderHook, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { LocalVehicleDetail } from '@/domain/repositories/VehicleRepository';
import { useVehicleTransferViewModel } from './useVehicleTransferViewModel';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({ vehicleId: 'v1' })),
}));
jest.mock('@/application/providers/DatabaseProvider', () => ({ useDatabase: jest.fn() }));

import { useDatabase } from '@/application/providers/DatabaseProvider';

const mockUseDatabase = useDatabase as jest.MockedFunction<typeof useDatabase>;
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
  totalSpent: null,
  lastLoggedAt: null,
  transferPending: false,
  pendingTransferRecipientEmail: null,
};

function setDatabase(foundVehicle: LocalVehicleDetail | null, initiateTransferImpl?: () => Promise<void>) {
  const initiateTransfer = jest.fn(initiateTransferImpl ?? (async () => {}));
  mockUseDatabase.mockReturnValue({
    isReady: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vehicleRepository: { findById: jest.fn(async () => foundVehicle), initiateTransfer } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    outboxRepository: {} as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logEntryRepository: {} as any,
  });
  return { initiateTransfer };
}

describe('useVehicleTransferViewModel', () => {
  afterEach(() => jest.clearAllMocks());

  it('loads the vehicle display name and sub-meta from local SQLite', async () => {
    setDatabase(vehicle);

    const { result } = await renderHook(() => useVehicleTransferViewModel());

    await waitFor(() => expect(result.current.loadState).toBe('ready'));
    expect(result.current.vehicleDisplayName).toBe('Blackbird');
    expect(result.current.vehicleSubMeta).toBe('2019 Honda CB650R');
  });

  it('falls back to make + model when there is no nickname', async () => {
    setDatabase({ ...vehicle, nickname: null });

    const { result } = await renderHook(() => useVehicleTransferViewModel());

    await waitFor(() => expect(result.current.loadState).toBe('ready'));
    expect(result.current.vehicleDisplayName).toBe('Honda CB650R');
  });

  it('shows not-found when the vehicle does not exist locally', async () => {
    setDatabase(null);

    const { result } = await renderHook(() => useVehicleTransferViewModel());

    await waitFor(() => expect(result.current.loadState).toBe('not-found'));
  });

  it('blocks submission and surfaces an error for an invalid email', async () => {
    setDatabase(vehicle);

    const { result } = await renderHook(() => useVehicleTransferViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    await act(async () => {
      result.current.updateRecipientEmail('not-an-email');
    });
    await act(async () => {
      result.current.submit();
    });

    expect(result.current.emailError).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('blocks submission when the email is empty', async () => {
    setDatabase(vehicle);

    const { result } = await renderHook(() => useVehicleTransferViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    await act(async () => {
      result.current.submit();
    });

    expect(result.current.emailError).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('clears the email error as soon as the field is edited', async () => {
    setDatabase(vehicle);

    const { result } = await renderHook(() => useVehicleTransferViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    await act(async () => {
      result.current.submit();
    });
    expect(result.current.emailError).toBeTruthy();

    await act(async () => {
      result.current.updateRecipientEmail('buyer@example.com');
    });

    expect(result.current.emailError).toBeNull();
  });

  it('submits via vehicleRepository.initiateTransfer with a trimmed, lowercased email and navigates back', async () => {
    const { initiateTransfer } = setDatabase(vehicle);

    const { result } = await renderHook(() => useVehicleTransferViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    await act(async () => {
      result.current.updateRecipientEmail('  Buyer@Example.com  ');
    });
    await act(async () => {
      result.current.submit();
    });

    expect(initiateTransfer).toHaveBeenCalledWith('v1', 'buyer@example.com');
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('shows a submit error and does not navigate when the local write throws', async () => {
    setDatabase(vehicle, async () => {
      throw new Error('disk full');
    });

    const { result } = await renderHook(() => useVehicleTransferViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    await act(async () => {
      result.current.updateRecipientEmail('buyer@example.com');
    });
    await act(async () => {
      result.current.submit();
    });

    expect(result.current.submitError).toBe("Couldn't send the transfer. Try again in a moment.");
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('onCancel navigates back', async () => {
    setDatabase(vehicle);

    const { result } = await renderHook(() => useVehicleTransferViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    result.current.onCancel();

    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
