import { renderHook, act, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ApiError, verifyEmail, resendVerification } from '@maintenance-log/api-client';
import type { Session } from '@maintenance-log/api-client';
import { useVerifyEmailViewModel } from './useVerifyEmailViewModel';
import { useAuth } from '@/application/providers/AuthProvider';
import { logger } from '@/infrastructure/logging/logger';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() }, useLocalSearchParams: jest.fn() }));
jest.mock('@/application/providers/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('@/infrastructure/logging/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));
jest.mock('@maintenance-log/api-client', () => ({
  ...jest.requireActual('@maintenance-log/api-client'),
  verifyEmail: jest.fn(),
  resendVerification: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;
const mockVerifyEmail = verifyEmail as jest.MockedFunction<typeof verifyEmail>;
const mockResendVerification = resendVerification as jest.MockedFunction<typeof resendVerification>;

const EMAIL = 'rider@example.com';

const onboardingSession: Session = {
  accessToken: 'a',
  accessTokenExpiresAt: new Date().toISOString(),
  refreshToken: 'r',
  user: { id: 'user-1', accountId: 'account-1', role: 'OWNER' },
  account: { id: 'account-1', status: 'ONBOARDING' },
};

const setSession = jest.fn();

function auth(): ReturnType<typeof useAuth> {
  return {
    session: null,
    isRestoring: false,
    isOffline: false,
    hasStoredCredentials: false,
    setSession,
    clearSession: jest.fn(),
  };
}

async function setup() {
  mockUseAuth.mockReturnValue(auth());
  mockUseLocalSearchParams.mockReturnValue({ email: EMAIL });
  const { result } = await renderHook(() => useVerifyEmailViewModel());
  return { getVm: () => result.current };
}

async function enterCode(getVm: () => ReturnType<typeof useVerifyEmailViewModel>, code: string) {
  await act(async () => {
    getVm().onChangeCode(code);
  });
}

async function submit(getVm: () => ReturnType<typeof useVerifyEmailViewModel>) {
  await act(async () => {
    getVm().submit();
    await Promise.resolve();
  });
}

beforeEach(() => jest.clearAllMocks());

describe('useVerifyEmailViewModel', () => {
  it('starts empty, not submittable, with the email from the route params', async () => {
    const { getVm } = await setup();

    expect(getVm().email).toBe(EMAIL);
    expect(getVm().code).toBe('');
    expect(getVm().canSubmit).toBe(false);
    expect(getVm().error).toBeNull();
    expect(getVm().resendState).toBe('idle');
  });

  it('strips non-digits and caps the code at 6 characters', async () => {
    const { getVm } = await setup();

    await enterCode(getVm, '12a34b567');

    expect(getVm().code).toBe('123456');
    expect(getVm().canSubmit).toBe(true);
  });

  it('does not call the API when the code is not yet 6 digits', async () => {
    const { getVm } = await setup();

    await enterCode(getVm, '123');
    await submit(getVm);

    expect(mockVerifyEmail).not.toHaveBeenCalled();
  });

  it('verifies a correct code, stores the session, and routes by account status', async () => {
    mockVerifyEmail.mockResolvedValue(onboardingSession);
    const { getVm } = await setup();

    await enterCode(getVm, '123456');
    await submit(getVm);

    expect(mockVerifyEmail).toHaveBeenCalledWith(expect.anything(), { email: EMAIL, code: '123456' });
    await waitFor(() => expect(setSession).toHaveBeenCalledWith(onboardingSession));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/onboarding'));
  });

  it('shows the retry copy on invalid_code and does not navigate', async () => {
    mockVerifyEmail.mockRejectedValue(new ApiError(400, { error: 'invalid_code' }));
    const { getVm } = await setup();

    await enterCode(getVm, '000000');
    await submit(getVm);

    await waitFor(() => expect(getVm().error).toBe("That code isn't right. Check it and try again."));
    expect(setSession).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('shows the expired copy on code_expired', async () => {
    mockVerifyEmail.mockRejectedValue(new ApiError(400, { error: 'code_expired' }));
    const { getVm } = await setup();

    await enterCode(getVm, '123456');
    await submit(getVm);

    await waitFor(() =>
      expect(getVm().error).toBe('That code has expired or been used up. Request a new one.'),
    );
  });

  it('shows a generic service error and logs on a 5xx failure', async () => {
    mockVerifyEmail.mockRejectedValue(new ApiError(500, {}));
    const { getVm } = await setup();

    await enterCode(getVm, '123456');
    await submit(getVm);

    await waitFor(() =>
      expect(getVm().error).toBe('We stalled. Our mechanics are on it — try again in a moment.'),
    );
    expect(logger.error).toHaveBeenCalledWith('verify-email request failed', expect.anything());
  });

  it('resends a code with the route email and moves to the sent state', async () => {
    mockResendVerification.mockResolvedValue(undefined);
    const { getVm } = await setup();

    await act(async () => {
      getVm().onResend();
      await Promise.resolve();
    });

    expect(mockResendVerification).toHaveBeenCalledWith(expect.anything(), { email: EMAIL });
    await waitFor(() => expect(getVm().resendState).toBe('sent'));
  });

  it('still lands in the sent state (and logs) when resend fails', async () => {
    mockResendVerification.mockRejectedValue(new ApiError(500, {}));
    const { getVm } = await setup();

    await act(async () => {
      getVm().onResend();
      await Promise.resolve();
    });

    await waitFor(() => expect(getVm().resendState).toBe('sent'));
    expect(logger.error).toHaveBeenCalledWith('verification resend failed', expect.anything());
  });
});
