import { act, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ApiError, forgotPassword } from '@maintenance-log/api-client';
import type { ForgotPasswordInput } from '@maintenance-log/domain';
import { renderViewModel } from '../../../test/renderViewModel';
import { useForgotPasswordViewModel, type ForgotPasswordViewModel } from './useForgotPasswordViewModel';
import { logger } from '@/infrastructure/logging/logger';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('@/infrastructure/logging/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));
jest.mock('@maintenance-log/api-client', () => ({
  ...jest.requireActual('@maintenance-log/api-client'),
  forgotPassword: jest.fn(),
}));

const mockForgotPassword = forgotPassword as jest.MockedFunction<typeof forgotPassword>;

const EMAIL = 'rider@example.com';

async function setup() {
  const { getVm, setFieldValue } = await renderViewModel<ForgotPasswordViewModel, ForgotPasswordInput>(
    useForgotPasswordViewModel,
    (vm) => vm.control,
    ['email'],
  );

  async function fillAndSubmit(email: string) {
    await setFieldValue('email', email);
    await act(async () => {
      await getVm().submit();
    });
  }

  return { getVm, fillAndSubmit };
}

describe('useForgotPasswordViewModel', () => {
  afterEach(() => jest.clearAllMocks());

  it('starts with no error and not submitting', async () => {
    const { getVm } = await setup();

    expect(getVm().error).toBeNull();
    expect(getVm().isSubmitting).toBe(false);
  });

  it('blocks submission and calls nothing when the email is invalid', async () => {
    const { fillAndSubmit } = await setup();

    await fillAndSubmit('not-an-email');

    expect(mockForgotPassword).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('requests a code and advances to reset-password carrying the email on success', async () => {
    mockForgotPassword.mockResolvedValue(undefined);
    const { fillAndSubmit } = await setup();

    await fillAndSubmit(EMAIL);

    expect(mockForgotPassword).toHaveBeenCalledWith(expect.anything(), { email: EMAIL });
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/(auth)/reset-password',
        params: { email: EMAIL },
      }),
    );
  });

  it('shows a generic service error and does not navigate on a 5xx failure', async () => {
    mockForgotPassword.mockRejectedValue(new ApiError(500, {}));
    const { getVm, fillAndSubmit } = await setup();

    await fillAndSubmit(EMAIL);

    await waitFor(() =>
      expect(getVm().error).toBe('We stalled. Our mechanics are on it — try again in a moment.'),
    );
    expect(router.push).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith('forgot-password request failed', expect.anything());
  });

  it('navigates back to login via onBackToLogin', async () => {
    const { getVm } = await setup();

    getVm().onBackToLogin();

    expect(router.back).toHaveBeenCalled();
  });
});
