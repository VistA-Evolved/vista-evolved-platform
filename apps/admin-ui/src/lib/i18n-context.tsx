'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SupportedLocale, getStoredLocale, storeLocale, isRtl } from './i18n';

type Messages = Record<string, unknown>;

interface I18nContextValue {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  dir: 'ltr' | 'rtl';
}

const I18nContext = createContext<I18nContextValue | null>(null);

async function loadMessages(locale: SupportedLocale): Promise<Messages> {
  try {
    const mod = await import(`../../messages/${locale}.json`);
    return mod.default as Messages;
  } catch {
    if (locale !== 'en') {
      const fallback = await import('../../messages/en.json');
      return fallback.default as Messages;
    }
    return {};
  }
}

function getNestedValue(obj: Messages, key: string): string | undefined {
  const parts = key.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : undefined;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>('en');
  const [messages, setMessages] = useState<Messages>({});

  useEffect(() => {
    const initial = getStoredLocale();
    setLocaleState(initial);
    loadMessages(initial).then(setMessages);
  }, []);

  const setLocale = useCallback((next: SupportedLocale) => {
    storeLocale(next);
    setLocaleState(next);
    loadMessages(next).then(setMessages);
    document.documentElement.lang = next;
    document.documentElement.dir = isRtl(next) ? 'rtl' : 'ltr';
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const value = getNestedValue(messages, key);
      if (value === undefined) return key;
      return interpolate(value, params);
    },
    [messages],
  );

  const dir: 'ltr' | 'rtl' = isRtl(locale) ? 'rtl' : 'ltr';

  return <I18nContext.Provider value={{ locale, setLocale, t, dir }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
