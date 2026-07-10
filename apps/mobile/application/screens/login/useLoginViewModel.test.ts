import { act, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { Session } from '@maintenance-log/api-client';
import type { LoginInput } from '@maintenance-log/contracts';
import { renderViewModel } from '../../../test/renderViewModel';
import { useLoginViewModel, type LoginViewModel } from './useLoginViewModel';
import { useSignIn, type SignInResult } from '@/application/auth/useSignIn';
import { biometrics } from '@/adapters/biometrics/biometrics';
import { credentialStore } from '@/adapters/storage/credentialStore';
import { preferences } from '@/adapters/storage/preferences';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('@/application/auth/useSignIn', () => ({ useSignIn: jest.fn() }));
jest.mock('@/adapters/biometrics/biometrics', () => ({
  biometrics: { isAvailable: jest.fn(), authenticate: jest.fn() },
}));
jest.mock('@/adapters/storage/credentialStore', () => ({
  credentialStore: { get: jest.fn(), has: jest.fn() },
}));
jest.mock('@/adapters/storage/preferences', () => ({
  preferences: { getBiometricUnlockEnabled: jest.fn(), getHasPromptedBiometric: jest.fn() },
}));

const mockUseSignIn = useSignIn as jest.MockedFunction<typeof useSignIn>;
const mockSignIn = jest.fn<Promise<SignInResult>, [LoginInput]>();
const mockIsAvailable = biometrics.isAvailable as jest.Mock;
const mockAuthenticate = biometrics.authenticate as jest.Mock;
const mockCredGet = credentialStore.get as jest.Mock;
const mockCredHas = credentialStore.has as jest.Mock;
const mockGetEnabled = preferences.getBiometricUnlockEnabled as jest.Mock;
const mockGetPrompted = preferences.getHasPromptedBiometric as jest.Mock;

const onboardingSession: Session = {
  accessToken: 'a',
  accessTokenExpiresAt: new Date().toISOString(),
  user: { id: 'user-1', accountId: 'account-1', role: 'OWNER' },
  account: { id: 'account-1', status: 'ONBOARDING' },
};
const activeOfflineSession: Session = {
  accessToken: '',
  accessTokenExpiresAt: new Date(0).toISOString(),
  user: { id: 'user-1', accountId: 'account-1', role: 'OWNER' },
  account: { id: 'account-1', status: 'ACTIVE' },
};
const storedCredential = {
  email: 'owner@example.com',
  password: 'S3cret pass',
  userId: 'user-1',
  accountId: 'account-1',
  role: 'OWNER',
  accountStatus: 'ACTIVE' as const,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseSignIn.mockReturnValue(mockSignIn);
  // Defaults: biometric off, hardware absent, already prompted — so the mount
  // effect no-ops and online login routes straight home. Tests override these.
  mockGetEnabled.mockResolvedValue(false);
  mockGetPrompted.mockResolvedValue(true);
  mockIsAvailable.mockResolvedValue(false);
  mockAuthenticate.mockResolvedValue(false);
  mockCredHas.mockResolvedValue(false);
  mockCredGet.mockResolvedValue(null);
});

async function setup() {
  const utils = await renderViewModel<LoginViewModel, LoginInput>(
    useLoginViewModel,
    (vm) => vm.control,
    ['email', 'password'],
  );

  async function fillAndSubmit(email: string, password: string) {
    await utils.setFieldValue('email', email);
    await utils.setFieldValue('password', password);
    await act(async () => {
      await utils.getVm().submit();
    });
  }

  return { ...utils, fillAndSubmit };
}

describe('useLoginViewModel — password sign-in', () => {
  it('routes to the account destination on an online login', async () => {
    mockSignIn.mockResolvedValue({ status: 'online', session: onboardingSession });
    const { fillAndSubmit } = await setup();

    await fillAndSubmit('user@example.com', 'password1');

    expect(mockSignIn).toHaveBeenCalledWith({ email: 'user@example.com', password: 'password1' });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/onboarding'));
  });

  it('routes to biometric enrolment after an online login when hardware is available and not yet offered', async () => {
    mockSignIn.mockResolvedValue({ status: 'online', session: onboardingSession });
    mockGetPrompted.mockResolvedValue(false);
    mockGetEnabled.mockResolvedValue(false);
    mockIsAvailable.mockResolvedValue(true);
    const { fillAndSubmit } = await setup();

    await fillAndSubmit('user@example.com', 'password1');

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(auth)/enable-biometrics'));
  });

  it('signs in offline and routes home when the server is unreachable', async () => {
    mockSignIn.mockResolvedValue({ status: 'offline', session: activeOfflineSession });
    const { fillAndSubmit } = await setup();

    await fillAndSubmit('user@example.com', 'password1');

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/garage'));
  });

  it('shows the offline-mismatch error when offline credentials do not match', async () => {
    mockSignIn.mockResolvedValue({ status: 'offlineUnavailable' });
    const { getVm, fillAndSubmit } = await setup();

    await fillAndSubmit('user@example.com', 'password1');

    await waitFor(() =>
      expect(getVm().error).toBe(
        "You're offline, and these credentials don't match your last sign-in on this device.",
      ),
    );
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('shows the invalid-credentials error on a 4xx', async () => {
    mockSignIn.mockResolvedValue({ status: 'invalidCredentials' });
    const { getVm, fillAndSubmit } = await setup();

    await fillAndSubmit('user@example.com', 'wrong');

    await waitFor(() =>
      expect(getVm().error).toBe(
        "Couldn't sign you in. Check your email and password — or your inbox if you haven't confirmed your account yet.",
      ),
    );
  });

  it('shows the service error on a 5xx', async () => {
    mockSignIn.mockResolvedValue({ status: 'serviceError' });
    const { getVm, fillAndSubmit } = await setup();

    await fillAndSubmit('user@example.com', 'password1');

    await waitFor(() => expect(getVm().error).toBe('We stalled. Our mechanics are on it — try again in a moment.'));
  });

  it('does not call signIn when the form is invalid', async () => {
    const { getVm } = await setup();
    await act(async () => {
      await getVm().submit();
    });
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('navigates to Forgot Password and Register', async () => {
    const { getVm } = await setup();
    getVm().onForgotPassword();
    expect(router.push).toHaveBeenCalledWith('/(auth)/forgot-password');
    getVm().onRegister();
    expect(router.push).toHaveBeenCalledWith('/(auth)/register');
  });
});

describe('useLoginViewModel — biometric unlock', () => {
  it('keeps the biometric button hidden and does not prompt when biometric is disabled', async () => {
    const { getVm } = await setup();
    // Let the mount effect settle.
    await act(async () => {
      await Promise.resolve();
    });
    expect(getVm().biometricAvailable).toBe(false);
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it('reveals the button and auto-unlocks on mount when set up', async () => {
    mockGetEnabled.mockResolvedValue(true);
    mockIsAvailable.mockResolvedValue(true);
    mockCredHas.mockResolvedValue(true);
    mockCredGet.mockResolvedValue(storedCredential);
    mockAuthenticate.mockResolvedValue(true);
    mockSignIn.mockResolvedValue({ status: 'online', session: activeOfflineSession });

    const { getVm } = await setup();

    await waitFor(() => expect(getVm().biometricAvailable).toBe(true));
    await waitFor(() =>
      expect(mockSignIn).toHaveBeenCalledWith({ email: 'owner@example.com', password: 'S3cret pass' }),
    );
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/garage'));
  });

  it('stays on the form when biometry is cancelled', async () => {
    mockAuthenticate.mockResolvedValue(false);
    const { getVm } = await setup();

    await act(async () => {
      getVm().onBiometricUnlock();
      await Promise.resolve();
    });

    expect(mockSignIn).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(getVm().error).toBeNull();
  });
});
