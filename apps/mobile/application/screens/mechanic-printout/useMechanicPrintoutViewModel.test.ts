import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';
import { router } from 'expo-router';
import { getReportToken, createReportToken, revokeReportToken } from '@maintenance-log/api-client';
import type { LocalVehicleDetail } from '@/domain/repositories/VehicleRepository';
import { useMechanicPrintoutViewModel } from './useMechanicPrintoutViewModel';

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({ vehicleId: 'v1' })),
}));
jest.mock('@/application/providers/DatabaseProvider', () => ({ useDatabase: jest.fn() }));
jest.mock('@/adapters/logging/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));
jest.mock('@maintenance-log/api-client', () => ({
  ...jest.requireActual('@maintenance-log/api-client'),
  getReportToken: jest.fn(),
  createReportToken: jest.fn(),
  revokeReportToken: jest.fn(),
}));

import { useDatabase } from '@/application/providers/DatabaseProvider';

const mockUseDatabase = useDatabase as jest.MockedFunction<typeof useDatabase>;
const mockGetToken = getReportToken as jest.MockedFunction<typeof getReportToken>;
const mockCreateToken = createReportToken as jest.MockedFunction<typeof createReportToken>;
const mockRevokeToken = revokeReportToken as jest.MockedFunction<typeof revokeReportToken>;
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

const SHARE_URL = 'https://revlog.dev/report/8f3a-92ee-4c1b';

function setDatabase(foundVehicle: LocalVehicleDetail | null = vehicle) {
  mockUseDatabase.mockReturnValue({
    isReady: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vehicleRepository: { findById: jest.fn(async () => foundVehicle) } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    outboxRepository: {} as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logEntryRepository: {} as any,
  });
}

describe('useMechanicPrintoutViewModel', () => {
  afterEach(() => jest.clearAllMocks());

  it('fetches the token on open and shows has-token with the vehicle name and url', async () => {
    setDatabase();
    mockGetToken.mockResolvedValue({ shareToken: '8f3a', shareUrl: SHARE_URL });

    const { result } = await renderHook(() => useMechanicPrintoutViewModel());

    await waitFor(() => expect(result.current.state).toBe('has-token'));
    expect(result.current.shareUrl).toBe(SHARE_URL);
    await waitFor(() => expect(result.current.vehicleDisplayName).toBe('Blackbird'));
    expect(mockGetToken).toHaveBeenCalledWith(expect.anything(), 'v1');
  });

  it('shows no-token when the API returns a null shareUrl', async () => {
    setDatabase();
    mockGetToken.mockResolvedValue({ shareToken: null, shareUrl: null });

    const { result } = await renderHook(() => useMechanicPrintoutViewModel());

    await waitFor(() => expect(result.current.state).toBe('no-token'));
    expect(result.current.shareUrl).toBeNull();
  });

  it('surfaces the error state when the initial fetch fails, and retry recovers it', async () => {
    setDatabase();
    mockGetToken.mockRejectedValueOnce(new Error('network down'));

    const { result } = await renderHook(() => useMechanicPrintoutViewModel());
    await waitFor(() => expect(result.current.state).toBe('error'));

    mockGetToken.mockResolvedValueOnce({ shareToken: null, shareUrl: null });
    await act(async () => {
      result.current.retry();
    });
    await waitFor(() => expect(result.current.state).toBe('no-token'));
  });

  it('generates a link: calls createReportToken and moves to has-token', async () => {
    setDatabase();
    mockGetToken.mockResolvedValue({ shareToken: null, shareUrl: null });
    const { result } = await renderHook(() => useMechanicPrintoutViewModel());
    await waitFor(() => expect(result.current.state).toBe('no-token'));

    mockCreateToken.mockResolvedValue({ shareToken: '8f3a', shareUrl: SHARE_URL });
    await act(async () => {
      result.current.generate();
    });

    expect(mockCreateToken).toHaveBeenCalledWith(expect.anything(), 'v1');
    await waitFor(() => expect(result.current.state).toBe('has-token'));
    expect(result.current.shareUrl).toBe(SHARE_URL);
  });

  it('shows an inline error and stays on no-token when generate fails', async () => {
    setDatabase();
    mockGetToken.mockResolvedValue({ shareToken: null, shareUrl: null });
    const { result } = await renderHook(() => useMechanicPrintoutViewModel());
    await waitFor(() => expect(result.current.state).toBe('no-token'));

    mockCreateToken.mockRejectedValue(new Error('offline'));
    await act(async () => {
      result.current.generate();
    });

    await waitFor(() => expect(result.current.actionError).toBeTruthy());
    expect(result.current.state).toBe('no-token');
  });

  it('shares the url via the native share sheet', async () => {
    setDatabase();
    mockGetToken.mockResolvedValue({ shareToken: '8f3a', shareUrl: SHARE_URL });
    const shareSpy = jest
      .spyOn(Share, 'share')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValue({ action: 'sharedAction' } as any);

    const { result } = await renderHook(() => useMechanicPrintoutViewModel());
    await waitFor(() => expect(result.current.state).toBe('has-token'));

    await act(async () => {
      result.current.share();
    });

    expect(shareSpy).toHaveBeenCalledWith(expect.objectContaining({ url: SHARE_URL }));
    shareSpy.mockRestore();
  });

  it('revokes after confirmation: calls revokeReportToken and returns to no-token', async () => {
    setDatabase();
    mockGetToken.mockResolvedValue({ shareToken: '8f3a', shareUrl: SHARE_URL });
    const { result } = await renderHook(() => useMechanicPrintoutViewModel());
    await waitFor(() => expect(result.current.state).toBe('has-token'));

    await act(async () => {
      result.current.openRevokeDialog();
    });
    expect(result.current.revokeDialogOpen).toBe(true);

    mockRevokeToken.mockResolvedValue(undefined);
    await act(async () => {
      result.current.confirmRevoke();
    });

    expect(mockRevokeToken).toHaveBeenCalledWith(expect.anything(), 'v1');
    await waitFor(() => expect(result.current.state).toBe('no-token'));
    expect(result.current.shareUrl).toBeNull();
    expect(result.current.revokeDialogOpen).toBe(false);
  });

  it('keeps the dialog open with an error when revoke fails', async () => {
    setDatabase();
    mockGetToken.mockResolvedValue({ shareToken: '8f3a', shareUrl: SHARE_URL });
    const { result } = await renderHook(() => useMechanicPrintoutViewModel());
    await waitFor(() => expect(result.current.state).toBe('has-token'));

    await act(async () => {
      result.current.openRevokeDialog();
    });
    mockRevokeToken.mockRejectedValue(new Error('offline'));
    await act(async () => {
      result.current.confirmRevoke();
    });

    await waitFor(() => expect(result.current.actionError).toBeTruthy());
    expect(result.current.state).toBe('has-token');
    expect(result.current.revokeDialogOpen).toBe(true);
  });

  it('onBack navigates back', async () => {
    setDatabase();
    mockGetToken.mockResolvedValue({ shareToken: null, shareUrl: null });
    const { result } = await renderHook(() => useMechanicPrintoutViewModel());
    await waitFor(() => expect(result.current.state).toBe('no-token'));

    result.current.onBack();

    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
