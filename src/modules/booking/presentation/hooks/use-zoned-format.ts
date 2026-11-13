/* eslint-disable no-restricted-syntax -- Booking times are statements about a place: they are read in the LOCATION's time zone, which useAppFormatters (bound to the request's zone) cannot do. The locale still comes from the request. This is the one approved exception (docs/architecture/i18n.md). */
import { useLocale } from '@i18n/client';

/** What a time or date shows when the value is missing or not a valid instant, so a screen never prints "Invalid Date". */
export const MISSING_VALUE = '–';

const RANGE_SEPARATOR = '–';
const NOON_UTC_HOURS = 12;

/**
 * An instant as the booking views carry it: ISO-8601 with an offset. Text without an offset names a
 * wall clock, not a moment, and is refused rather than read in the machine's zone.
 */
const INSTANT_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;
const CALENDAR_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Every format is a whole-instant statement in a stated zone; a calendar day has no zone at all. */
export interface ZonedFormat {
  /** `09:45`. */
  readonly time: (instant: string, zone: string) => string;
  /** `09:45–10:15`; the end is exclusive. */
  readonly timeRange: (start: string, end: string, zone: string) => string;
  /** `22.04.2025`. */
  readonly date: (instant: string, zone: string) => string;
  /** `Dienstag, 22. April 2025`. */
  readonly longDate: (instant: string, zone: string) => string;
  /** `22.04.2025, 09:45`. */
  readonly dateTime: (instant: string, zone: string) => string;
  /** The zone's short name at that instant (`MESZ`), for a view that spans zones. */
  readonly zoneName: (instant: string, zone: string) => string;
  /** A calendar day `YYYY-MM-DD` of a location, as `Dienstag, 22. April 2025`. */
  readonly calendarDate: (day: string) => string;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(locale: string, zone: string, options: Intl.DateTimeFormatOptions) {
  const key = `${locale}|${zone}|${JSON.stringify(options)}`;
  const cached = formatters.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const created = new Intl.DateTimeFormat(locale, { ...options, timeZone: zone });
  formatters.set(key, created);
  return created;
}

function instantOf(text: string): Date | null {
  if (!INSTANT_WITH_OFFSET.test(text)) {
    return null;
  }
  const instant = new Date(text);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

/** Formats `text` in `zone`, or the missing value when the text or the zone is not valid. */
function formatIn(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): (text: string, zone: string) => string {
  return (text, zone) => {
    const instant = instantOf(text);
    if (instant === null) {
      return MISSING_VALUE;
    }
    try {
      return formatterFor(locale, zone, options).format(instant);
    } catch (error) {
      // An unknown zone name is the only way `Intl` throws for a valid instant.
      if (error instanceof RangeError) {
        return MISSING_VALUE;
      }
      throw error;
    }
  };
}

/** The formats of one locale. Pure, so a Server Component can use it as well as the hook below. */
export function createZonedFormat(locale: string): ZonedFormat {
  const time = formatIn(locale, { hour: '2-digit', minute: '2-digit' });
  const zoneName = (text: string, zone: string) => {
    const instant = instantOf(text);
    if (instant === null) {
      return MISSING_VALUE;
    }
    try {
      const parts = formatterFor(locale, zone, { timeZoneName: 'short' }).formatToParts(instant);
      return parts.find((part) => part.type === 'timeZoneName')?.value ?? MISSING_VALUE;
    } catch (error) {
      if (error instanceof RangeError) {
        return MISSING_VALUE;
      }
      throw error;
    }
  };

  return {
    time,
    timeRange: (start, end, zone) => {
      const from = time(start, zone);
      const to = time(end, zone);
      return from === MISSING_VALUE || to === MISSING_VALUE
        ? MISSING_VALUE
        : `${from}${RANGE_SEPARATOR}${to}`;
    },
    date: formatIn(locale, { dateStyle: 'medium' }),
    longDate: formatIn(locale, { dateStyle: 'full' }),
    dateTime: formatIn(locale, { dateStyle: 'medium', timeStyle: 'short' }),
    zoneName,
    calendarDate: (day) => {
      const match = CALENDAR_DAY.exec(day);
      if (match === null) {
        return MISSING_VALUE;
      }
      const year = Number(match[1]);
      const monthIndex = Number(match[2]) - 1;
      const dayOfMonth = Number(match[3]);
      // Noon UTC read in UTC: the same calendar day in every zone, whatever the machine's own.
      const utc = new Date(Date.UTC(year, monthIndex, dayOfMonth, NOON_UTC_HOURS));
      // 2027-02-30 rolls over to March: an impossible day is refused, not shown as another one.
      const isSameDay =
        utc.getUTCFullYear() === year &&
        utc.getUTCMonth() === monthIndex &&
        utc.getUTCDate() === dayOfMonth;
      return isSameDay
        ? formatterFor(locale, 'UTC', { dateStyle: 'full' }).format(utc)
        : MISSING_VALUE;
    },
  };
}

/** The formats of the request's locale, for Client Components. */
export function useZonedFormat(): ZonedFormat {
  return createZonedFormat(useLocale());
}

/* eslint-enable no-restricted-syntax -- end of the one approved formatting exception */
