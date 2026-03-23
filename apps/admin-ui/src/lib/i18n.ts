'use client';

export const SUPPORTED_LOCALES = ['en', 'es', 'fil', 'ar'] as const;
export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: 'English',
  es: 'Español',
  fil: 'Filipino',
  ar: 'العربية',
};

export const RTL_LOCALES: SupportedLocale[] = ['ar'];

export function isRtl(locale: SupportedLocale): boolean {
  return RTL_LOCALES.includes(locale);
}

const LOCALE_STORAGE_KEY = 've_admin_locale';

export function getStoredLocale(): SupportedLocale {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored && SUPPORTED_LOCALES.includes(stored as SupportedLocale)) {
    return stored as SupportedLocale;
  }
  const browser = navigator.language.split('-')[0] as SupportedLocale;
  if (SUPPORTED_LOCALES.includes(browser)) return browser;
  return 'en';
}

export function storeLocale(locale: SupportedLocale): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }
}
