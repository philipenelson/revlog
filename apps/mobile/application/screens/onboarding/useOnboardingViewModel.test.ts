import { act, renderHook, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ApiError, skipOnboarding } from '@maintenance-log/api-client';
import { useOnboardingViewModel } from './useOnboardingViewModel';
import { useDatabase } from '@/application/providers/DatabaseProvider';
import { useAuth } from '@/application/providers/AuthProvider';
import { logger } from '@/infrastructure/logging/logger';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/application/providers/DatabaseProvider', () => ({ useDatabase: jest.fn() }));
jest.mock('@/application/providers/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('@/infrastructure/logging/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));
jest.mock('@maintenance-log/api-client', () => ({
  ...jest.requireActual('@maintenance-log/api-client'),
  skipOnboarding: jest.fn(),
}));

const mockUseDatabase = useDatabase as jest.MockedFunction<typeof useDatabase>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockSkipOnboarding = skipOnboarding as jest.MockedFunction<typeof skipOnboarding>;
const mockReplace = router.replace as jest.Mock;

const resolveOnboarding = jest.fn();

function setup(createImpl?: () => Promise<string>) {
  const create = jest.fn(createImpl ?? (async () => 'veh-1'));
  mockUseDatabase.mockReturnValue({
    isReady: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vehicleRepository: { create } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    outboxRepository: {} as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logEntryRepository: {} as any,
  });
  mockUseAuth.mockReturnValue({
    session: null,
    isRestoring: false,
    isOffline: false,
    hasStoredCredentials: false,
    setSession: jest.fn(),
    resolveOnboarding,
    clearSession: jest.fn(),
  });
  return { create, hook: renderHook(() => useOnboardingViewModel()) };
}

async function fillVehicle(
  result: { current: ReturnType<typeof useOnboardingViewModel> },
  fields: Partial<Record<'make' | 'model' | 'year' | 'mileage' | 'nickname', string>>,
) {
  await act(async () => {
    for (const [field, value] of Object.entries(fields)) {
      result.current.updateField(field as 'make', value);
    }
  });
}

beforeEach(() => jest.clearAllMocks());

describe('useOnboardingViewModel', () => {
  it('starts on the welcome step with empty fields', async () => {
    const { hook } = setup();
    const { result } = await hook;

    expect(result.current.step).toBe(1);
    expect(result.current.fields).toEqual({ nickname: '', make: '', model: '', year: '', mileage: '' });
  });

  it('advances to the vehicle step and back to welcome', async () => {
    const { hook } = setup();
    const { result } = await hook;

    await act(async () => result.current.goToVehicleStep());
    expect(result.current.step).toBe(2);

    await act(async () => result.current.goBackToWelcome());
    expect(result.current.step).toBe(1);
  });

  it('blocks continue and surfaces field errors when required fields are invalid', async () => {
    const { create, hook } = setup();
    const { result } = await hook;

    await act(async () => result.current.onContinue());

    expect(result.current.errors.make).toBeTruthy();
    expect(result.current.errors.model).toBeTruthy();
    expect(create).not.toHaveBeenCalled();
    expect(result.current.step).not.toBe(3);
  });

  it('creates the vehicle via the repository, resolves onboarding, and advances to Ready', async () => {
    const { create, hook } = setup();
    const { result } = await hook;

    await fillVehicle(result, { make: 'Honda', model: 'CB650R', year: '2019', mileage: '12,500', nickname: 'Blackbird' });
    await act(async () => result.current.onContinue());

    // Comma stripped, values coerced; created through the repository (no photo arg).
    expect(create).toHaveBeenCalledWith({
      nickname: 'Blackbird',
      make: 'Honda',
      model: 'CB650R',
      year: 2019,
      mileage: 12500,
    });
    await waitFor(() => expect(resolveOnboarding).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.step).toBe(3));
    expect(result.current.readyHeadline).toBe('Blackbird is in your garage');
  });

  it('falls back to make + model in the Ready headline when no nickname is given', async () => {
    const { hook } = setup();
    const { result } = await hook;

    await fillVehicle(result, { make: 'Honda', model: 'CB650R', year: '2019', mileage: '4200' });
    await act(async () => result.current.onContinue());

    await waitFor(() => expect(result.current.readyHeadline).toBe('Honda CB650R is in your garage'));
  });

  it('shows a submit error and does not advance or resolve when the local write throws', async () => {
    const { hook } = setup(async () => {
      throw new Error('disk full');
    });
    const { result } = await hook;

    await act(async () => result.current.goToVehicleStep());
    await fillVehicle(result, { make: 'Honda', model: 'CB650R', year: '2019', mileage: '4200' });
    await act(async () => result.current.onContinue());

    await waitFor(() => expect(result.current.submitError).toBe("Couldn't save your vehicle. Try again in a moment."));
    expect(result.current.step).toBe(2);
    expect(resolveOnboarding).not.toHaveBeenCalled();
  });

  it('skips: calls skipOnboarding, resolves onboarding, and routes to the garage', async () => {
    mockSkipOnboarding.mockResolvedValue(undefined);
    const { hook } = setup();
    const { result } = await hook;

    await act(async () => result.current.onSkip());

    expect(mockSkipOnboarding).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(resolveOnboarding).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/garage'));
  });

  it('shows a skip error and does not navigate on a 4xx failure', async () => {
    mockSkipOnboarding.mockRejectedValue(new ApiError(400, {}));
    const { hook } = setup();
    const { result } = await hook;

    await act(async () => result.current.onSkip());

    await waitFor(() => expect(result.current.skipError).toBe("Couldn't skip right now. Try again in a moment."));
    expect(resolveOnboarding).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows a generic service error and logs on a 5xx skip failure', async () => {
    mockSkipOnboarding.mockRejectedValue(new ApiError(500, {}));
    const { hook } = setup();
    const { result } = await hook;

    await act(async () => result.current.onSkip());

    await waitFor(() =>
      expect(result.current.skipError).toBe('We stalled. Our mechanics are on it — try again in a moment.'),
    );
    expect(logger.error).toHaveBeenCalledWith('skip onboarding failed', expect.anything());
  });

  it('routes to the garage from the Ready step', async () => {
    const { hook } = setup();
    const { result } = await hook;

    await act(async () => result.current.onGoToGarage());

    expect(mockReplace).toHaveBeenCalledWith('/garage');
  });
});
