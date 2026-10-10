/* eslint-disable no-restricted-syntax -- Slot and booking times are read in the LOCATION's time zone, which useAppFormatters (bound to the request zone) cannot do; the locale still comes from the request via useLocale. */
import { useMemo } from 'react';

import { useLocale } from '@i18n/client';

import { MS_PER_DAY } from '@lib/utils';

import { parseLocalDate } from '../../application/contracts/booking-constraints';

const UTC = 'UTC';
const NOON = 12;
/** A Monday, so weekday number N is that day plus N - 1 days. */
const REFERENCE_YEAR = 2024;
const MONDAY_2024 = Date.UTC(REFERENCE_YEAR, 0, 1);
/** Any year works for a time of day; it only has to be a real date. */
const ANY_YEAR = 2000;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

/** A calendar day as a `Date` that formats the same in every zone: noon UTC, formatted in UTC. */
function localDateToDate(localDate: string): Date | null {
  const parsed = parseLocalDate(localDate);
  return parsed === null
    ? null
    : new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, NOON));
}

function timeToDate(localTime: string): Date | null {
  const match = TIME_PATTERN.exec(localTime);
  return match === null
    ? null
    : new Date(Date.UTC(ANY_YEAR, 0, 1, Number(match[1]), Number(match[2])));
}

export interface ZonedFormat {
  /** `2026-10-12` as "Monday, 12 October 2026". */
  readonly longDate: (localDate: string) => string;
  /** `2026-10-12` as "Mon, 12 Oct". */
  readonly shortDate: (localDate: string) => string;
  /** `2026-10-12` as "October 2026". */
  readonly monthYear: (localDate: string) => string;
  /** `2026-10-12` as "12". */
  readonly dayNumber: (localDate: string) => string;
  /** `10:30` in the visitor's clock convention ("10:30 AM" or "10:30"). */
  readonly timeOfDay: (localTime: string) => string;
  /** An instant as a date and time at the location. */
  readonly dateTime: (instant: string) => string;
  /** A short weekday name for an ISO weekday (1 = Monday). */
  readonly weekdayName: (weekday: number, style: 'short' | 'long') => string;
  /** The time-zone name to show beside a time ("Central European Summer Time"). */
  readonly zoneName: (instant: string) => string;
}

/**
 * Formatters bound to the visitor's language and to the LOCATION's time zone.
 * Slot and booking times are statements about a place, so they are read in
 * the place's zone; a visitor in another country sees what the clock on the
 * wall of the town hall shows. Calendar days carry no zone at all.
 */
export function useZonedFormat(timeZone: string): ZonedFormat {
  const locale = useLocale();

  return useMemo(() => {
    const longDate = new Intl.DateTimeFormat(locale, {
      timeZone: UTC,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const shortDate = new Intl.DateTimeFormat(locale, {
      timeZone: UTC,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    const monthYear = new Intl.DateTimeFormat(locale, {
      timeZone: UTC,
      month: 'long',
      year: 'numeric',
    });
    const dayNumber = new Intl.DateTimeFormat(locale, { timeZone: UTC, day: 'numeric' });
    const timeOfDay = new Intl.DateTimeFormat(locale, {
      timeZone: UTC,
      hour: 'numeric',
      minute: '2-digit',
    });
    const dateTime = new Intl.DateTimeFormat(locale, {
      timeZone,
      dateStyle: 'full',
      timeStyle: 'short',
    });
    const zoneName = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: 'long' });
    const weekdayShort = new Intl.DateTimeFormat(locale, { timeZone: UTC, weekday: 'short' });
    const weekdayLong = new Intl.DateTimeFormat(locale, { timeZone: UTC, weekday: 'long' });

    const onDate = (format: Intl.DateTimeFormat) => (localDate: string) => {
      const date = localDateToDate(localDate);
      return date === null ? localDate : format.format(date);
    };

    return {
      longDate: onDate(longDate),
      shortDate: onDate(shortDate),
      monthYear: onDate(monthYear),
      dayNumber: onDate(dayNumber),
      timeOfDay: (localTime) => {
        const date = timeToDate(localTime);
        return date === null ? localTime : timeOfDay.format(date);
      },
      dateTime: (instant) => dateTime.format(new Date(instant)),
      weekdayName: (weekday, style) =>
        (style === 'short' ? weekdayShort : weekdayLong).format(
          new Date(MONDAY_2024 + (weekday - 1) * MS_PER_DAY),
        ),
      zoneName: (instant) => {
        const part = zoneName
          .formatToParts(new Date(instant))
          .find((p) => p.type === 'timeZoneName');
        return part?.value ?? timeZone;
      },
    };
  }, [locale, timeZone]);
}

/* eslint-enable no-restricted-syntax -- End of the location-zone exception above. */
