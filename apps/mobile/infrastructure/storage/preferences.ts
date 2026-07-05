import * as SecureStore from 'expo-secure-store';
import { DEFAULT_LOCALE, isAppLocale, type AppLocale } from '@/domain/locale';

// Non-secret device preferences, deliberately separate from secureStorage.ts
// (auth secrets). Backed by expo-secure-store to avoid adding an
// AsyncStorage dependency (ADR 0035); unlike the tokens, this key is never
// cleared on logout or cold start, which is what a device-level language
// choice wants. Full i18n will read the same key later.
const LOCALE_KEY = 'appLocale';

// Biometric unlock preferences (ADR 0036). Non-secret device flags, stored
// here rather than in secureStorage.ts (which holds auth secrets and is
// cleared on cold start): whether the Owner has turned biometric unlock on,
// and whether the one-time post-login enrolment prompt has already been
// shown. Both are reset on logout (see AuthProvider) via clearBiometric().
const BIOMETRIC_ENABLED_KEY = 'biometricUnlockEnabled';
const BIOMETRIC_PROMPTED_KEY = 'biometricPrompted';

export const preferences = {
  // Always resolves to a supported locale — an unset or unrecognized stored
  // value falls back to the default rather than surfacing null to callers.
  async getLocale(): Promise<AppLocale> {
    const stored = await SecureStore.getItemAsync(LOCALE_KEY);
    return isAppLocale(stored) ? stored : DEFAULT_LOCALE;
  },
  async setLocale(locale: AppLocale): Promise<void> {
    await SecureStore.setItemAsync(LOCALE_KEY, locale);
  },

  async getBiometricUnlockEnabled(): Promise<boolean> {
    return (await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY)) === 'true';
  },
  async setBiometricUnlockEnabled(enabled: boolean): Promise<void> {
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
  },

  async getHasPromptedBiometric(): Promise<boolean> {
    return (await SecureStore.getItemAsync(BIOMETRIC_PROMPTED_KEY)) === 'true';
  },
  async setHasPromptedBiometric(prompted: boolean): Promise<void> {
    await SecureStore.setItemAsync(BIOMETRIC_PROMPTED_KEY, prompted ? 'true' : 'false');
  },

  // Reset on logout — both flags drop so the next account gets a clean slate
  // (re-offered the enrolment prompt, biometric off until re-enabled).
  async clearBiometric(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY),
      SecureStore.deleteItemAsync(BIOMETRIC_PROMPTED_KEY),
    ]);
  },
};
