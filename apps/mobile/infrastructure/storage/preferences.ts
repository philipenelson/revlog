import * as SecureStore from 'expo-secure-store';
import { DEFAULT_LOCALE, isAppLocale, type AppLocale } from '@/domain/locale';

// Non-secret device preferences, deliberately separate from secureStorage.ts
// (auth secrets). Backed by expo-secure-store to avoid adding an
// AsyncStorage dependency (ADR 0035); unlike the tokens, this key is never
// cleared on logout or cold start, which is what a device-level language
// choice wants. Full i18n will read the same key later.
const LOCALE_KEY = 'appLocale';

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
};
