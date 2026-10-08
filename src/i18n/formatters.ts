import { formatDate, formatDateTime, formatRelativeTime, type DateInput } from '@lib/utils/date';
import { formatNumber, formatPercent, formatMoney, formatBytes } from '@lib/utils/number';

import { I18N_CONFIG, type Locale, type Direction } from './config';

export type AppFormatters = ReturnType<typeof createAppFormatters>;

/**
 * Locale- and time-zone-bound formatters. Components never pass a locale to
 * `@lib/utils` themselves: they read these through `getAppFormatters`
 * (`@i18n/server`) or `useAppFormatters` (`@i18n/client`), so every date and
 * number on a page follows the request locale.
 */
export function createAppFormatters(locale: string, timeZone: string) {
  return {
    date: (input: DateInput, options?: Intl.DateTimeFormatOptions) =>
      formatDate(input, locale, timeZone, options),
    dateTime: (input: DateInput) => formatDateTime(input, locale, timeZone),
    relativeTime: (input: DateInput, now: DateInput) => formatRelativeTime(input, now, locale),
    number: (value: number, options?: Intl.NumberFormatOptions) =>
      formatNumber(value, locale, options),
    percent: (ratio: number, fractionDigits?: number) =>
      formatPercent(ratio, locale, fractionDigits),
    money: (minorUnits: number, currency: string) => formatMoney(minorUnits, currency, locale),
    bytes: (bytes: number, fractionDigits?: number) => formatBytes(bytes, locale, fractionDigits),
  };
}

export function getDirection(locale: Locale): Direction {
  return I18N_CONFIG.definitions[locale].direction;
}
