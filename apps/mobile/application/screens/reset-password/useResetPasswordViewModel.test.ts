import { act, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ApiError, resetPassword, forgotPassword } from '@maintenance-log/api-client';
import type { Session } from '@maintenance-log/api-client';
import type { ResetPasswordInput } from '@maintenance-log/contracts';
import { renderViewModel } from '../../../test/renderViewModel';
import { useResetPasswordViewModel, type ResetPasswordViewModel } from './useResetPasswordViewModel';
import { useAuth } from '@/application/providers/AuthProvider';
import { logger } from '@/adapters/logging/logger';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));
jest.mock('@/application/providers/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('@/adapters/logging/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));
jest.mock('@maintenance-log/api-client', () => ({
  ...jest.requireActual('@maintenance-log/api-client'),
  resetPassword: jest.fn(),
  forgotPassword: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;
const mockResetPassword = resetPassword as jest.MockedFunction<typeof resetPassword>;
const mockForgotPassword = forgotPassword as jest.MockedFunction<typeof forgotPassword>;

const EMAIL = 'rider@example.com';
const CODE = '654321';
const NEW_PASSWORD = 'BrandNewPass9';

const activeSession: Session = {
  accessToken: 'a',
  accessTokenExpiresAt: new Date().toISOString(),
  refreshToken: 'r',
  user: { id: 'user-1', accountId: 'account-1', role: 'OWNER' },
  account: { id: 'account-1', status: 'ACTIVE' },
};

const setSession = jest.fn();

function auth(): ReturnType<typeof useAuth> {
  return {
    session: null,
    isRestoring: false,
    isOffline: false,
    hasStoredCredentials: false,
    setSession,
    resolveOnboarding: jest.fn(),
    clearSession: jest.fn(),
  };
}

async function setup() {
  mockUseAuth.mockReturnValue(auth());
  mockUseLocalSearchParams.mockReturnValue({ email: EMAIL });

  const { getVm, setFieldValue } = await renderViewModel<ResetPasswordViewModel, ResetPasswordInput>(
    useResetPasswordViewModel,
    (vm) => vm.control,
    ['code', 'newPassword', 'confirmPassword'],
  );

  async function fillAndSubmit(fields: { code: string; newPassword: string; confirmPassword: string }) {
    await setFieldValue('code', fields.code);
    await setFieldValue('newPassword', fields.newPassword);
    await setFieldValue('confirmPassword', fields.confirmPassword);
    await act(async () => {
      await getVm().submit();
    });
  }

  return { getVm, fillAndSubmit };
}

const validFields = { code: CODE, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD };

beforeEach(() => jest.clearAllMocks());

describe('useResetPasswordViewModel', () => {
  it('starts with the email from route params, no error, not submitting', async () => {
    const { getVm } = await setup();

    expect(getVm().email).toBe(EMAIL);
    expect(getVm().error).toBeNull();
    expect(getVm().isSubmitting).toBe(false);
    expect(getVm().resendState).toBe('idle');
  });

  it('blocks submission when the code is not 6 digits', async () => {
    const { fillAndSubmit } = await setup();

    await fillAndSubmit({ ...validFields, code: '123' });

    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('blocks submission and flags a mismatch when the passwords differ', async () => {
    const { getVm, fillAndSubmit } = await setup();

    await fillAndSubmit({ ...validFields, confirmPassword: 'DifferentPass9' });

    expect(mockResetPassword).not.toHaveBeenCalled();
    expect(getVm().errors.confirmPassword?.message).toBe('Passwords do not match');
  });

  it('blocks submission when the new password is too weak', async () => {
    const { fillAndSubmit } = await setup();

    await fillAndSubmit({ code: CODE, newPassword: 'short', confirmPassword: 'short' });

    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('resets the password, stores the session, and routes by account status on success', async () => {
    mockResetPassword.mockResolvedValue(activeSession);
    const { fillAndSubmit } = await setup();

    await fillAndSubmit(validFields);

    expect(mockResetPassword).toHaveBeenCalledWith(expect.anything(), {
      email: EMAIL,
      code: CODE,
      newPassword: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    });
    await waitFor(() => expect(setSession).toHaveBeenCalledWith(activeSession));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/garage'));
  });

  it('shows the retry copy on invalid_code and does not navigate', async () => {
    mockResetPassword.mockRejectedValue(new ApiError(400, { error: 'invalid_code' }));
    const { getVm, fillAndSubmit } = await setup();

    await fillAndSubmit(validFields);

    await waitFor(() => expect(getVm().error).toBe("That code isn't right. Check it and try again."));
    expect(setSession).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('shows the expired copy on code_expired', async () => {
    mockResetPassword.mockRejectedValue(new ApiError(400, { error: 'code_expired' }));
    const { getVm, fillAndSubmit } = await setup();

    await fillAndSubmit(validFields);

    await waitFor(() =>
      expect(getVm().error).toBe('That code has expired or been used up. Request a new one.'),
    );
  });

  it('shows a generic service error and logs on a 5xx failure', async () => {
    mockResetPassword.mockRejectedValue(new ApiError(500, {}));
    const { getVm, fillAndSubmit } = await setup();

    await fillAndSubmit(validFields);

    await waitFor(() =>
      expect(getVm().error).toBe('We stalled. Our mechanics are on it — try again in a moment.'),
    );
    expect(logger.error).toHaveBeenCalledWith('reset-password request failed', expect.anything());
  });

  it('resends a code with the route email and moves to the sent state', async () => {
    mockForgotPassword.mockResolvedValue(undefined);
    const { getVm } = await setup();

    await act(async () => {
      getVm().onResend();
      await Promise.resolve();
    });

    expect(mockForgotPassword).toHaveBeenCalledWith(expect.anything(), { email: EMAIL });
    await waitFor(() => expect(getVm().resendState).toBe('sent'));
  });

  it('still lands in the sent state (and logs) when resend fails', async () => {
    mockForgotPassword.mockRejectedValue(new ApiError(500, {}));
    const { getVm } = await setup();

    await act(async () => {
      getVm().onResend();
      await Promise.resolve();
    });

    await waitFor(() => expect(getVm().resendState).toBe('sent'));
    expect(logger.error).toHaveBeenCalledWith('password reset resend failed', expect.anything());
  });

  it('navigates back to the request screen via onBackToRequest', async () => {
    const { getVm } = await setup();

    getVm().onBackToRequest();

    expect(router.back).toHaveBeenCalled();
  });
});
