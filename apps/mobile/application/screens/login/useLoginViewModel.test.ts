import { act, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ApiError, login } from '@maintenance-log/api-client';
import type { Session } from '@maintenance-log/api-client';
import type { LoginInput } from '@maintenance-log/domain';
import { renderViewModel } from '../../../test/renderViewModel';
import { useLoginViewModel, type LoginViewModel } from './useLoginViewModel';
import { useAuth } from '@/application/providers/AuthProvider';
import { logger } from '@/infrastructure/logging/logger';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('@/application/providers/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('@/infrastructure/logging/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));
jest.mock('@maintenance-log/api-client', () => ({
  ...jest.requireActual('@maintenance-log/api-client'),
  login: jest.fn(),
}));

const mockLogin = login as jest.MockedFunction<typeof login>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const fakeSession: Session = {
  accessToken: 'access-token',
  accessTokenExpiresAt: new Date().toISOString(),
  user: { id: 'user-1', accountId: 'account-1', role: 'OWNER' },
  account: { id: 'account-1', status: 'ONBOARDING' },
};

async function setup() {
  const setSession = jest.fn();
  mockUseAuth.mockReturnValue({ session: null, isRestoring: false, setSession, clearSession: jest.fn() });

  const { getVm, setFieldValue } = await renderViewModel<LoginViewModel, LoginInput>(
    useLoginViewModel,
    (vm) => vm.control,
    ['email', 'password'],
  );

  async function fillAndSubmit(email: string, password: string) {
    await setFieldValue('email', email);
    await setFieldValue('password', password);
    await act(async () => {
      await getVm().submit();
    });
  }

  return { getVm, setSession, fillAndSubmit };
}

describe('useLoginViewModel', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('starts with no error and not submitting', async () => {
    const { getVm } = await setup();

    expect(getVm().error).toBeNull();
    expect(getVm().isSubmitting).toBe(false);
  });

  it('blocks submission when the form is invalid', async () => {
    const { getVm } = await setup();

    await act(async () => {
      await getVm().submit();
    });

    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('signs in and routes to the account status destination on success', async () => {
    const { setSession, fillAndSubmit } = await setup();
    mockLogin.mockResolvedValue(fakeSession);

    await fillAndSubmit('user@example.com', 'password1');

    expect(setSession).toHaveBeenCalledWith(fakeSession);
    expect(router.replace).toHaveBeenCalledWith('/onboarding');
  });

  it('shows a user-facing error for invalid credentials (4xx)', async () => {
    const { getVm, setSession, fillAndSubmit } = await setup();
    mockLogin.mockRejectedValue(new ApiError(401, { message: 'Invalid email or password' }));

    await fillAndSubmit('user@example.com', 'wrong-password');

    await waitFor(() =>
      expect(getVm().error).toBe(
        "Couldn't sign you in. Check your email and password — or your inbox if you haven't confirmed your account yet.",
      ),
    );
    expect(setSession).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('shows a generic service error and logs on a 5xx failure', async () => {
    const { getVm, fillAndSubmit } = await setup();
    mockLogin.mockRejectedValue(new ApiError(500, {}));

    await fillAndSubmit('user@example.com', 'password1');

    await waitFor(() => expect(getVm().error).toBe('We stalled. Our mechanics are on it — try again in a moment.'));
    expect(logger.error).toHaveBeenCalledWith('login request failed', expect.anything());
  });

  it('navigates to Forgot Password and Register', async () => {
    const { getVm } = await setup();

    getVm().onForgotPassword();
    expect(router.push).toHaveBeenCalledWith('/(auth)/forgot-password');

    getVm().onRegister();
    expect(router.push).toHaveBeenCalledWith('/(auth)/register');
  });
});
