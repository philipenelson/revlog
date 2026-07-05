// Supported app languages for the Settings language selector (ADR 0035).
// This task ships the selector + a persisted preference only — translating
// app strings is a later V1 i18n effort that will read the same preference.

export type AppLocale = 'en' | 'pt-BR' | 'es';

export const DEFAULT_LOCALE: AppLocale = 'en';

export const SUPPORTED_LOCALES: ReadonlyArray<{ code: AppLocale; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'pt-BR', label: 'Português (Brasil)' },
  { code: 'es', label: 'Español' },
];

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return SUPPORTED_LOCALES.some((locale) => locale.code === value);
}

export function localeLabel(code: AppLocale): string {
  return SUPPORTED_LOCALES.find((locale) => locale.code === code)?.label ?? code;
}
