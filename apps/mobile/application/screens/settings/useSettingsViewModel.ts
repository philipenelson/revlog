import { useCallback, useState } from 'react';
import { Linking } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ApiError, logout as logoutRequest, type UserProfile } from '@maintenance-log/api-client';
import { tokenHttpClient } from '@/infrastructure/http/TokenHttpClient';
import { useAuth } from '@/application/providers/AuthProvider';
import { useDatabase } from '@/application/providers/DatabaseProvider';
import { logger } from '@/infrastructure/logging/logger';

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
    logoutDialogOpen,
    openLogoutDialog,
    closeLogoutDialog,
    isLoggingOut,
    logoutError,
    confirmLogout: () => void handleLogout(),
  };
}
