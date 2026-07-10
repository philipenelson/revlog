import { renderHook, act, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { Session } from '@maintenance-log/api-client';
import { useEnableBiometricsViewModel } from './useEnableBiometricsViewModel';
import { useAuth } from '@/application/providers/AuthProvider';
import { biometrics } from '@/adapters/biometrics/biometrics';
import { preferences } from '@/adapters/storage/preferences';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/application/providers/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('@/adapters/biometrics/biometrics', () => ({
  biometrics: { authenticate: jest.fn() },
}));
jest.mock('@/adapters/storage/preferences', () => ({
  preferences: { setBiometricUnlockEnabled: jest.fn(), setHasPromptedBiometric: jest.fn() },
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockAuthenticate = biometrics.authenticate as jest.Mock;
const mockSetEnabled = preferences.setBiometricUnlockEnabled as jest.Mock;
const mockSetPrompted = preferences.setHasPromptedBiometric as jest.Mock;

const activeSession: Session = {
  accessToken: 'a',
  accessTokenExpiresAt: new Date().toISOString(),
  user: { id: 'user-1', accountId: 'account-1', role: 'OWNER' },
  account: { id: 'account-1', status: 'ACTIVE' },
};

function auth(session: Session | null): ReturnType<typeof useAuth> {
  return {
    session,
    isRestoring: false,
    isOffline: false,
    hasStoredCredentials: true,
    setSession: jest.fn(),
    resolveOnboarding: jest.fn(),
    clearSession: jest.fn(),
  };
}

async function setup(session: Session | null = activeSession) {
  mockUseAuth.mockReturnValue(auth(session));
  mockSetEnabled.mockResolvedValue(undefined);
  mockSetPrompted.mockResolvedValue(undefined);
  const { result } = await renderHook(() => useEnableBiometricsViewModel());
  return { getVm: () => result.current };
}

beforeEach(() => jest.clearAllMocks());

describe('useEnableBiometricsViewModel', () => {
  it('enables biometric on a successful check, marks prompted, and routes home', async () => {
    mockAuthenticate.mockResolvedValue(true);
    const { getVm } = await setup();

    await act(async () => {
      getVm().onEnable();
      await Promise.resolve();
    });

    await waitFor(() => expect(mockSetEnabled).toHaveBeenCalledWith(true));
    expect(mockSetPrompted).toHaveBeenCalledWith(true);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/garage'));
  });

  it('does not enable and stays on the screen when biometry is cancelled', async () => {
    mockAuthenticate.mockResolvedValue(false);
    const { getVm } = await setup();

    await act(async () => {
      getVm().onEnable();
      await Promise.resolve();
    });

    await waitFor(() => expect(getVm().isEnabling).toBe(false));
    expect(mockSetEnabled).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('marks prompted and routes home when skipped, without a biometry check', async () => {
    const { getVm } = await setup();

    await act(async () => {
      getVm().onSkip();
      await Promise.resolve();
    });

    await waitFor(() => expect(mockSetPrompted).toHaveBeenCalledWith(true));
    expect(mockAuthenticate).not.toHaveBeenCalled();
    expect(mockSetEnabled).not.toHaveBeenCalled();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/garage'));
  });

  it('falls back to login when there is no session', async () => {
    const { getVm } = await setup(null);

    await act(async () => {
      getVm().onSkip();
      await Promise.resolve();
    });

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(auth)/login'));
  });
});
