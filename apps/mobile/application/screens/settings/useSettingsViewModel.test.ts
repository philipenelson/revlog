import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import { ApiError, logout, type UserProfile } from '@maintenance-log/api-client';
import { useSettingsViewModel } from './useSettingsViewModel';

// useFocusEffect stands in for a plain useEffect (no navigation container in
// the test renderer) — same approach as useGarageViewModel.test.
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    router: { replace: jest.fn(), back: jest.fn() },
    useFocusEffect: (effect: () => void) => useEffect(effect),
  };
});
jest.mock('@/application/providers/DatabaseProvider', () => ({ useDatabase: jest.fn() }));
jest.mock('@/application/providers/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('@/infrastructure/logging/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));
jest.mock('@maintenance-log/api-client', () => ({
  ...jest.requireActual('@maintenance-log/api-client'),
  logout: jest.fn(),
}));
jest.mock('@/infrastructure/storage/preferences', () => ({
  preferences: { getLocale: jest.fn(), setLocale: jest.fn() },
}));

import { useDatabase } from '@/application/providers/DatabaseProvider';
import { useAuth } from '@/application/providers/AuthProvider';
import { preferences } from '@/infrastructure/storage/preferences';

const mockUseDatabase = useDatabase as jest.MockedFunction<typeof useDatabase>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockLogout = logout as jest.MockedFunction<typeof logout>;
const mockReplace = router.replace as jest.Mock;
const mockGetLocale = preferences.getLocale as jest.MockedFunction<typeof preferences.getLocale>;
const mockSetLocale = preferences.setLocale as jest.MockedFunction<typeof preferences.setLocale>;

const profile: UserProfile = { id: 'u1', fullName: 'Philip Russo', email: 'p@example.com', role: 'OWNER' };

let clearSession: jest.Mock;

function setDatabase(found: UserProfile | null = profile) {
  mockUseDatabase.mockReturnValue({
    isReady: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vehicleRepository: {} as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    outboxRepository: {} as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logEntryRepository: {} as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    profileRepository: { get: jest.fn(async () => found), save: jest.fn() } as any,
  });
}

describe('useSettingsViewModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearSession = jest.fn();
    mockUseAuth.mockReturnValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      session: {} as any,
      isRestoring: false,
      setSession: jest.fn(),
      clearSession,
    });
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as unknown as boolean);
    mockGetLocale.mockResolvedValue('en');
    mockSetLocale.mockResolvedValue(undefined);
    setDatabase();
  });

  it('loads the Owner profile from the local cache (offline-first)', async () => {
    const { result } = await renderHook(() => useSettingsViewModel());

    await waitFor(() => expect(result.current.profile).toEqual(profile));
  });

  it('renders no cached profile (null) without throwing', async () => {
    setDatabase(null);

    const { result } = await renderHook(() => useSettingsViewModel());

    await waitFor(() => expect(result.current.profile).toBeNull());
  });

  it('opens each legal + support URL in the browser', async () => {
    const { result } = await renderHook(() => useSettingsViewModel());

    result.current.onOpenTerms();
    result.current.onOpenPrivacy();
    result.current.onOpenCookies();
    result.current.onOpenSupport();

    expect(Linking.openURL).toHaveBeenCalledWith('https://revlog.dev/terms');
    expect(Linking.openURL).toHaveBeenCalledWith('https://revlog.dev/privacy');
    expect(Linking.openURL).toHaveBeenCalledWith('https://revlog.dev/cookies');
    expect(Linking.openURL).toHaveBeenCalledWith('https://revlog.dev');
  });

  it('loads the persisted language on mount and exposes its label', async () => {
    mockGetLocale.mockResolvedValue('pt-BR');

    const { result } = await renderHook(() => useSettingsViewModel());

    await waitFor(() => expect(result.current.locale).toBe('pt-BR'));
    expect(result.current.localeLabel).toBe('Português (Brasil)');
  });

  it('selecting a language persists it, updates the label, and closes the dialog', async () => {
    const { result } = await renderHook(() => useSettingsViewModel());
    await waitFor(() => expect(result.current.locale).toBe('en'));

    await act(async () => {
      result.current.openLanguageDialog();
    });
    expect(result.current.languageDialogOpen).toBe(true);

    await act(async () => {
      result.current.onSelectLanguage('es');
    });

    expect(mockSetLocale).toHaveBeenCalledWith('es');
    expect(result.current.locale).toBe('es');
    expect(result.current.localeLabel).toBe('Español');
    expect(result.current.languageDialogOpen).toBe(false);
  });

  it('exposes the supported locales for the picker', async () => {
    const { result } = await renderHook(() => useSettingsViewModel());

    expect(result.current.supportedLocales.map((l) => l.code)).toEqual(['en', 'pt-BR', 'es']);
  });

  it('opens and closes the logout confirmation dialog', async () => {
    const { result } = await renderHook(() => useSettingsViewModel());

    await act(async () => {
      result.current.openLogoutDialog();
    });
    expect(result.current.logoutDialogOpen).toBe(true);

    await act(async () => {
      result.current.closeLogoutDialog();
    });
    expect(result.current.logoutDialogOpen).toBe(false);
  });

  it('on a successful logout, revokes server-side then clears the session and navigates to login', async () => {
    mockLogout.mockResolvedValue(undefined);
    const { result } = await renderHook(() => useSettingsViewModel());

    await act(async () => {
      result.current.confirmLogout();
    });

    await waitFor(() => expect(clearSession).toHaveBeenCalledTimes(1));
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('completes logout locally when the server responds with an error (e.g. already-invalid token)', async () => {
    mockLogout.mockRejectedValue(new ApiError(401, { error: 'Invalid or expired access token' }));
    const { result } = await renderHook(() => useSettingsViewModel());

    await act(async () => {
      result.current.confirmLogout();
    });

    await waitFor(() => expect(clearSession).toHaveBeenCalledTimes(1));
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
    expect(result.current.logoutError).toBeNull();
  });

  it('on a network failure, keeps the session and shows the online-required error', async () => {
    mockLogout.mockRejectedValue(new Error('Network request failed'));
    const { result } = await renderHook(() => useSettingsViewModel());

    await act(async () => {
      result.current.confirmLogout();
    });

    await waitFor(() => expect(result.current.logoutError).toBe('You need to be online to log out.'));
    expect(clearSession).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(result.current.isLoggingOut).toBe(false);
  });
});
