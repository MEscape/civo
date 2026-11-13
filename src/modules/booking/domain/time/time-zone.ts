import { MS_PER_DAY, MS_PER_MINUTE, MS_PER_SECOND } from '@lib/utils';
import type { Brand } from '@lib/utils';

import { fromEpochDay } from './local-date';

import type { Instant } from './instant';
import type { LocalDate } from './local-date';

/**
 * An IANA time zone name ("Europe/Berlin"), canonical spelling.
 *
 * Every conversion between an instant and a wall clock names its zone explicitly. The machine's zone
 * and the visitor's browser zone never take part: a location's opening hours mean the same thing
 * whoever looks at them from wherever.
 */
export type TimeZone = Brand<string, 'TimeZone'>;

const ZONE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/;
const HOURS_PER_DAY = 24;

const formatters = new Map<string, Intl.DateTimeFormat>();

/**
 * Formatters are expensive to build and a scheduling query asks for the offset thousands of times,
 * so one per zone is kept. The cache holds no state that affects results.
 */
function formatterFor(zone: string): Intl.DateTimeFormat {
  const cached = formatters.get(zone);
  if (cached !== undefined) {
    return cached;
  }
  const created = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });
  formatters.set(zone, created);
  return created;
}

/** Validates an IANA zone name and returns its canonical spelling, or `null`. */
export function parseTimeZone(raw: string): TimeZone | null {
  if (!ZONE_NAME_PATTERN.test(raw)) {
    return null;
  }
  try {
    // Brand constructor: the cast is only permitted here.
    return formatterFor(raw).resolvedOptions().timeZone as TimeZone;
  } catch {
    // `Intl` throws a RangeError for a zone it does not know; that is the "invalid" answer.
    return null;
  }
}

/** The zone's offset from UTC at an instant, in milliseconds (positive east of Greenwich). */
export function zoneOffsetMs(epochMs: number, zone: TimeZone): number {
  let year = 0;
  let month = 1;
  let day = 1;
  let hour = 0;
  let minute = 0;
  let second = 0;
  for (const part of formatterFor(zone).formatToParts(epochMs)) {
    switch (part.type) {
      case 'year':
        year = Number(part.value);
        break;
      case 'month':
        month = Number(part.value);
        break;
      case 'day':
        day = Number(part.value);
        break;
      case 'hour':
        hour = Number(part.value) % HOURS_PER_DAY;
        break;
      case 'minute':
        minute = Number(part.value);
        break;
      case 'second':
        second = Number(part.value);
        break;
      default:
        break;
    }
  }
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return wallClockAsUtc - Math.floor(epochMs / MS_PER_SECOND) * MS_PER_SECOND;
}

/** The wall clock showing in a zone: a local date and whole minutes after local midnight. */
export interface WallClock {
  readonly date: LocalDate;
  readonly minuteOfDay: number;
}

export function wallClockOf(instant: Instant, zone: TimeZone): WallClock {
  const local = instant + zoneOffsetMs(instant, zone);
  const epochDay = Math.floor(local / MS_PER_DAY);
  return {
    date: fromEpochDay(epochDay),
    minuteOfDay: Math.floor((local - epochDay * MS_PER_DAY) / MS_PER_MINUTE),
  };
}

export function localDateOf(instant: Instant, zone: TimeZone): LocalDate {
  return wallClockOf(instant, zone).date;
}
