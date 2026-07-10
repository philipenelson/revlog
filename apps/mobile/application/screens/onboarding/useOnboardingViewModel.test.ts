import { act, renderHook, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ApiError, skipOnboarding } from '@maintenance-log/api-client';
import { useOnboardingViewModel } from './useOnboardingViewModel';
import { useDatabase } from '@/application/providers/DatabaseProvider';
import { useAuth } from '@/application/providers/AuthProvider';
import { logger } from '@/adapters/logging/logger';
import * as ImagePicker from 'expo-image-picker';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/application/providers/DatabaseProvider', () => ({ useDatabase: jest.fn() }));
jest.mock('@/application/providers/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('@/adapters/logging/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));
jest.mock('@maintenance-log/api-client', () => ({
  ...jest.requireActual('@maintenance-log/api-client'),
  skipOnboarding: jest.fn(),
}));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

const mockUseDatabase = useDatabase as jest.MockedFunction<typeof useDatabase>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockSkipOnboarding = skipOnboarding as jest.MockedFunction<typeof skipOnboarding>;
const mockReplace = router.replace as jest.Mock;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockRequestPermissions = ImagePicker.requestMediaLibraryPermissionsAsync as jest.MockedFunction<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockLaunchLibrary = ImagePicker.launchImageLibraryAsync as jest.MockedFunction<any>;

const PICKED_ASSET = { uri: 'file:///tmp/picker-cache/bike.jpg', fileName: 'bike.jpg', mimeType: 'image/jpeg' };

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

    // Comma stripped, values coerced; created through the repository. No photo
    // was picked, so the second arg is undefined.
    expect(create).toHaveBeenCalledWith(
      {
        nickname: 'Blackbird',
        make: 'Honda',
        model: 'CB650R',
        year: 2019,
        mileage: 12500,
      },
      undefined,
    );
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

  it('pickPhoto surfaces an error and sets no preview when library permission is denied', async () => {
    mockRequestPermissions.mockResolvedValue({ granted: false });
    const { hook } = setup();
    const { result } = await hook;

    await act(async () => result.current.pickPhoto());

    expect(result.current.photoError).toBe('Enable photo access in Settings to add a picture of your vehicle.');
    expect(result.current.photoPreviewUri).toBeNull();
    expect(mockLaunchLibrary).not.toHaveBeenCalled();
  });

  it('pickPhoto sets a preview from the picked asset', async () => {
    mockRequestPermissions.mockResolvedValue({ granted: true });
    mockLaunchLibrary.mockResolvedValue({ canceled: false, assets: [PICKED_ASSET] });
    const { hook } = setup();
    const { result } = await hook;

    await act(async () => result.current.pickPhoto());

    expect(result.current.photoPreviewUri).toBe(PICKED_ASSET.uri);
    expect(result.current.photoError).toBeNull();
  });

  it('pickPhoto leaves the preview unset when the picker is canceled', async () => {
    mockRequestPermissions.mockResolvedValue({ granted: true });
    mockLaunchLibrary.mockResolvedValue({ canceled: true, assets: null });
    const { hook } = setup();
    const { result } = await hook;

    await act(async () => result.current.pickPhoto());

    expect(result.current.photoPreviewUri).toBeNull();
  });

  it('removePhoto clears the preview and any photo error', async () => {
    mockRequestPermissions.mockResolvedValue({ granted: true });
    mockLaunchLibrary.mockResolvedValue({ canceled: false, assets: [PICKED_ASSET] });
    const { hook } = setup();
    const { result } = await hook;

    await act(async () => result.current.pickPhoto());
    expect(result.current.photoPreviewUri).not.toBeNull();

    await act(async () => result.current.removePhoto());

    expect(result.current.photoPreviewUri).toBeNull();
    expect(result.current.photoError).toBeNull();
  });

  it('passes the picked photo through to vehicleRepository.create', async () => {
    mockRequestPermissions.mockResolvedValue({ granted: true });
    mockLaunchLibrary.mockResolvedValue({ canceled: false, assets: [PICKED_ASSET] });
    const { create, hook } = setup();
    const { result } = await hook;

    await act(async () => result.current.pickPhoto());
    await fillVehicle(result, { make: 'Honda', model: 'CB650R', year: '2019', mileage: '4200' });
    await act(async () => result.current.onContinue());

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ make: 'Honda' }), {
        uri: PICKED_ASSET.uri,
        name: PICKED_ASSET.fileName,
        type: PICKED_ASSET.mimeType,
      }),
    );
  });

  it('creates without a photo (second arg undefined) when none was picked', async () => {
    const { create, hook } = setup();
    const { result } = await hook;

    await fillVehicle(result, { make: 'Honda', model: 'CB650R', year: '2019', mileage: '4200' });
    await act(async () => result.current.onContinue());

    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ make: 'Honda' }), undefined));
  });
});
