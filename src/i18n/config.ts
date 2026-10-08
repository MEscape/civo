import { notFound } from 'next/navigation';

import { createNavigation } from 'next-intl/navigation';
import { defineRouting } from 'next-intl/routing';
import { z } from 'zod';

import { notFoundError } from '@lib/errors';
import { err, ok, type AppResult } from '@lib/result';

import { I18N_ERROR_CODES } from './errors';

import type enMessages from './locales/en';

const LOCALES = ['en', 'de'] as const;

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_YEAR = 365;

const ONE_YEAR_IN_SECONDS = SECONDS_PER_MINUTE * MINUTES_PER_HOUR * HOURS_PER_DAY * DAYS_PER_YEAR;

export type Locale = (typeof LOCALES)[number];
export type Direction = 'ltr' | 'rtl';

export type MessageCatalog = typeof enMessages;
export type Namespace = keyof MessageCatalog;

interface LocaleDefinition {
  readonly label: string;
  readonly direction: Direction;
  readonly openGraphLocale: string;
}

const LOCALE_DEFINITIONS: Record<Locale, LocaleDefinition> = {
  en: { label: 'English', direction: 'ltr', openGraphLocale: 'en_US' },
  de: { label: 'Deutsch', direction: 'ltr', openGraphLocale: 'de_DE' },
};

export const I18N_CONFIG = {
  locales: LOCALES,
  defaultLocale: 'en' as Locale,
  definitions: LOCALE_DEFINITIONS,
  defaultTimeZone: 'Europe/Berlin',
  detection: { enabled: true },
  localeCookieMaxAgeSeconds: ONE_YEAR_IN_SECONDS,
} as const;

export const I18N_ROUTING = defineRouting({
  locales: I18N_CONFIG.locales,
  defaultLocale: I18N_CONFIG.defaultLocale,
  localePrefix: 'always',
  localeDetection: I18N_CONFIG.detection.enabled,
  localeCookie: { maxAge: I18N_CONFIG.localeCookieMaxAgeSeconds, sameSite: 'lax' },
  alternateLinks: false,
});

export const { Link, redirect, usePathname, useRouter } = createNavigation(I18N_ROUTING);

const localeSchema = z.enum(I18N_CONFIG.locales);

export function parseLocale(input: unknown): AppResult<Locale> {
  const parsed = localeSchema.safeParse(input);
  if (parsed.success) {
    return ok(parsed.data);
  }
  return err(notFoundError(I18N_ERROR_CODES.unsupportedLocale, 'Unsupported locale.'));
}

export function requireLocale(rawLocale: string): Locale {
  const parsed = parseLocale(rawLocale);
  if (parsed.isErr()) {
    notFound();
  }
  return parsed.value;
}

export function getMessageFallback(
  { namespace, key }: { namespace?: string; key: string },
  isDevelopment: boolean,
): string {
  return isDevelopment ? `⚠ ${namespace ? `${namespace}.` : ''}${key}` : key;
}
