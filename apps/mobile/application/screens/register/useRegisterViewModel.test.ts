import { act, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ApiError, register } from '@maintenance-log/api-client';
import type { RegisterInput } from '@maintenance-log/contracts';
import { renderViewModel } from '../../../test/renderViewModel';
import { useRegisterViewModel, type RegisterViewModel } from './useRegisterViewModel';
import { logger } from '@/adapters/logging/logger';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/adapters/logging/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));
jest.mock('@maintenance-log/api-client', () => ({
  ...jest.requireActual('@maintenance-log/api-client'),
  register: jest.fn(),
}));

const mockRegister = register as jest.MockedFunction<typeof register>;

async function setup() {
  const { getVm, setFieldValue } = await renderViewModel<RegisterViewModel, RegisterInput>(
    useRegisterViewModel,
    (vm) => vm.control,
    ['fullName', 'email', 'password', 'confirmPassword'],
  );

  async function fillAndSubmit(
    user: { fullName: string; email: string; password: string },
    confirmPassword: string,
  ) {
    await setFieldValue('fullName', user.fullName);
    await setFieldValue('email', user.email);
    await setFieldValue('password', user.password);
    await setFieldValue('confirmPassword', confirmPassword);
    await act(async () => {
      await getVm().submit();
    });
  }

  return { getVm, fillAndSubmit };
}

describe('useRegisterViewModel', () => {
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

    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('shows a validation error when passwords do not match', async () => {
    const { getVm, fillAndSubmit } = await setup();

    await fillAndSubmit(
      { fullName: 'E2E Test User', email: 'user@example.com', password: 'E2eTest1pass' },
      'SomethingElse1',
    );

    expect(mockRegister).not.toHaveBeenCalled();
    expect(getVm().errors.confirmPassword?.message).toBe('Passwords do not match');
  });

  it('creates the account and navigates to verify-email on success', async () => {
    const { fillAndSubmit } = await setup();
    mockRegister.mockResolvedValue(undefined);

    await fillAndSubmit(
      { fullName: 'E2E Test User', email: 'user@example.com', password: 'E2eTest1pass' },
      'E2eTest1pass',
    );

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(auth)/verify-email',
      params: { email: 'user@example.com' },
    });
  });

  it('shows a user-facing error when the email is already registered (4xx)', async () => {
    const { getVm, fillAndSubmit } = await setup();
    mockRegister.mockRejectedValue(new ApiError(409, { message: 'Email already registered' }));

    await fillAndSubmit(
      { fullName: 'E2E Test User', email: 'user@example.com', password: 'E2eTest1pass' },
      'E2eTest1pass',
    );

    await waitFor(() =>
      expect(getVm().error).toBe("Couldn't create your account. Check your details and try again."),
    );
    expect(router.push).not.toHaveBeenCalled();
  });

  it('shows a generic service error and logs on a 5xx failure', async () => {
    const { getVm, fillAndSubmit } = await setup();
    mockRegister.mockRejectedValue(new ApiError(500, {}));

    await fillAndSubmit(
      { fullName: 'E2E Test User', email: 'user@example.com', password: 'E2eTest1pass' },
      'E2eTest1pass',
    );

    await waitFor(() => expect(getVm().error).toBe('We stalled. Our mechanics are on it — try again in a moment.'));
    expect(logger.error).toHaveBeenCalledWith('registration request failed', expect.anything());
  });

  it('navigates to Login via onSignIn', async () => {
    const { getVm } = await setup();

    getVm().onSignIn();

    expect(router.push).toHaveBeenCalledWith('/(auth)/login');
  });
});
