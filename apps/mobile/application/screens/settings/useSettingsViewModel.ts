import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ApiError, logout as logoutRequest, type UserProfile } from '@maintenance-log/api-client';
import { tokenHttpClient } from '@/adapters/http/TokenHttpClient';
import { useAuth } from '@/application/providers/AuthProvider';
import { useDatabase } from '@/application/providers/DatabaseProvider';
import { preferences } from '@/adapters/storage/preferences';
import { biometrics } from '@/adapters/biometrics/biometrics';
import { credentialStore } from '@/adapters/storage/credentialStore';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, localeLabel, type AppLocale } from '@/domain/locale';
import { logger } from '@/adapters/logging/logger';

const LEGAL_URLS = {
  terms: 'https://revlog.dev/terms',
  privacy: 'https://revlog.dev/privacy',
  cookies: 'https://revlog.dev/cookies',
} as const;
const SUPPORT_URL = 'https://revlog.dev';
const LOGOUT_OFFLINE_ERROR = 'You need to be online to log out.';

export interface SettingsViewModel {
  profile: UserProfile | null;
  onBack: () => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
  onOpenCookies: () => void;
  onOpenSupport: () => void;
  // Language selector (ADR 0035) — persists a locale preference; no string
  // translation yet (that's the later i18n effort).
  locale: AppLocale;
  localeLabel: string;
  supportedLocales: ReadonlyArray<{ code: AppLocale; label: string }>;
  languageDialogOpen: boolean;
  openLanguageDialog: () => void;
  closeLanguageDialog: () => void;
  onSelectLanguage: (locale: AppLocale) => void;
  // Biometric unlock toggle (ADR 0036). Shown only when the device has
  // biometric hardware AND credentials are stored (both required to unlock).
  biometricAvailable: boolean;
  biometricEnabled: boolean;
  onToggleBiometric: () => void;
  // Logout confirmation dialog (state-driven, matching the app's other
  // confirmations — e.g. Delete Vehicle — rather than a native Alert).
  logoutDialogOpen: boolean;
  openLogoutDialog: () => void;
  closeLogoutDialog: () => void;
  isLoggingOut: boolean;
  logoutError: string | null;
  confirmLogout: () => void;
}

export function useSettingsViewModel(): SettingsViewModel {
  const { profileRepository } = useDatabase();
  const { clearSession } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [locale, setLocale] = useState<AppLocale>(DEFAULT_LOCALE);
  const [languageDialogOpen, setLanguageDialogOpen] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  // Offline-first read from the local cache (populated by SyncService's
  // GET /users/me pull, ADR 0033). Re-read on focus so a background sync's
  // refresh shows without remounting; renders stale data offline rather than
  // a loading/unavailable state.
  useFocusEffect(
    useCallback(() => {
      if (!profileRepository) return;
      void profileRepository.get().then(setProfile);
    }, [profileRepository]),
  );

  // Load the persisted language once on mount (device preference, ADR 0035).
  useEffect(() => {
    void preferences.getLocale().then(setLocale);
  }, []);

  // Resolve biometric state once on mount. The toggle only appears when the
  // hardware is present AND credentials are stored — biometric unlock replays
  // those credentials, so it's meaningless without them (ADR 0036).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [available, hasCreds, enabled] = await Promise.all([
        biometrics.isAvailable(),
        credentialStore.has(),
        preferences.getBiometricUnlockEnabled(),
      ]);
      if (cancelled) return;
      setBiometricAvailable(available && hasCreds);
      setBiometricEnabled(enabled);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Enabling requires a biometry check to confirm the Owner can actually pass
  // it; disabling is immediate. Stored credentials are left in place either way
  // (offline typed-login still uses them).
  async function toggleBiometric(): Promise<void> {
    if (biometricEnabled) {
      await preferences.setBiometricUnlockEnabled(false);
      setBiometricEnabled(false);
      return;
    }
    if (!(await biometrics.authenticate('Enable biometric unlock for Revlog'))) return;
    await preferences.setBiometricUnlockEnabled(true);
    setBiometricEnabled(true);
  }

  function openLanguageDialog(): void {
    setLanguageDialogOpen(true);
  }

  function closeLanguageDialog(): void {
    setLanguageDialogOpen(false);
  }

  function onSelectLanguage(next: AppLocale): void {
    setLocale(next);
    void preferences.setLocale(next);
    setLanguageDialogOpen(false);
  }

  function openLogoutDialog(): void {
    setLogoutError(null);
    setLogoutDialogOpen(true);
  }

  function closeLogoutDialog(): void {
    if (isLoggingOut) return;
    setLogoutDialogOpen(false);
    setLogoutError(null);
  }

  // Online-required (ADR 0034): revoke the refresh token server-side before
  // discarding the local session. A server *response* (2xx, or e.g. a 401
  // for an already-invalid token) completes logout — the session is invalid
  // regardless. Only a genuine network failure (no response) blocks it, so
  // the Owner isn't stranded half-logged-out offline.
  async function handleLogout(): Promise<void> {
    setIsLoggingOut(true);
    setLogoutError(null);
    try {
      await logoutRequest(tokenHttpClient);
      finishLogout();
    } catch (err) {
      if (err instanceof ApiError) {
        finishLogout();
      } else {
        logger.warn('logout failed — no server response (offline)', { err: String(err) });
        setLogoutError(LOGOUT_OFFLINE_ERROR);
        setIsLoggingOut(false);
      }
    }
  }

  function finishLogout(): void {
    clearSession();
    router.replace('/(auth)/login');
  }

  return {
    profile,
    onBack: () => router.back(),
    onOpenTerms: () => void Linking.openURL(LEGAL_URLS.terms),
    onOpenPrivacy: () => void Linking.openURL(LEGAL_URLS.privacy),
    onOpenCookies: () => void Linking.openURL(LEGAL_URLS.cookies),
    onOpenSupport: () => void Linking.openURL(SUPPORT_URL),
    locale,
    localeLabel: localeLabel(locale),
    supportedLocales: SUPPORTED_LOCALES,
    languageDialogOpen,
    openLanguageDialog,
    closeLanguageDialog,
    onSelectLanguage,
    biometricAvailable,
    biometricEnabled,
    onToggleBiometric: () => void toggleBiometric(),
    logoutDialogOpen,
    openLogoutDialog,
    closeLogoutDialog,
    isLoggingOut,
    logoutError,
    confirmLogout: () => void handleLogout(),
  };
}
