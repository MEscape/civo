import type { Brand } from '@lib/utils';

import { fromEpochDay, toEpochDay } from './local-date';
import { MINUTES_PER_DAY, MS_PER_MINUTE } from './time-of-day';

import type { LocalDate } from './local-date';

/**
 * An IANA time zone name ("Europe/Berlin"), canonical spelling.
 *
 * Every scheduling calculation names its zone explicitly. The machine's zone
 * and the visitor's browser zone never take part: a location's opening hours
 * mean the same thing whoever looks at them from wherever.
 */
export type TimeZone = Brand<string, 'TimeZone'>;

const MS_PER_DAY = MINUTES_PER_DAY * MS_PER_MINUTE;
const ZONE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/;
const MS_PER_SECOND = 1000;
const HOURS_PER_DAY = 24;

const formatters = new Map<string, Intl.DateTimeFormat>();

/**
 * Formatters are expensive to build and a scheduling query asks for the
 * offset thousands of times, so one per zone is kept. The cache holds no
 * state that affects results.
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
  const fields: Record<string, number> = {};
  for (const part of formatterFor(zone).formatToParts(epochMs)) {
    if (part.type !== 'literal') {
      fields[part.type] = Number(part.value);
    }
  }
  const wallClockAsUtc = Date.UTC(
    fields['year'] ?? 0,
    (fields['month'] ?? 1) - 1,
    fields['day'] ?? 1,
    (fields['hour'] ?? 0) % HOURS_PER_DAY,
    fields['minute'] ?? 0,
    fields['second'] ?? 0,
  );
  return wallClockAsUtc - Math.floor(epochMs / MS_PER_SECOND) * MS_PER_SECOND;
}

/**
 * The instant a wall-clock time falls on in a zone.
 *
 * Two days a year a wall-clock time is not a single instant, and this is
 * where that is decided, once:
 *  - a time the clocks skip (02:30 when 02:00 jumps to 03:00) moves forward
 *    by the length of the gap, so it lands on the first real instant after it;
 *  - a time that happens twice (02:30 when 03:00 falls back to 02:00) means
 *    its first occurrence.
 * This is the "compatible" disambiguation of the Temporal proposal.
 */
export function zonedTimeToEpoch(date: LocalDate, minuteOfDay: number, zone: TimeZone): number {
  const wallClockAsUtc = toEpochDay(date) * MS_PER_DAY + minuteOfDay * MS_PER_MINUTE;
  // The offsets a day either side bracket any transition near this wall-clock time.
  const offsetBefore = zoneOffsetMs(wallClockAsUtc - MS_PER_DAY, zone);
  const offsetAfter = zoneOffsetMs(wallClockAsUtc + MS_PER_DAY, zone);

  const matches = [wallClockAsUtc - offsetBefore, wallClockAsUtc - offsetAfter].filter(
    (candidate) => candidate + zoneOffsetMs(candidate, zone) === wallClockAsUtc,
  );
  return matches.length > 0 ? Math.min(...matches) : wallClockAsUtc - offsetBefore;
}

export interface ZonedWallClock {
  readonly date: LocalDate;
  readonly minuteOfDay: number;
}

/** The wall clock showing in a zone at an instant. */
export function epochToZonedWallClock(epochMs: number, zone: TimeZone): ZonedWallClock {
  const local = epochMs + zoneOffsetMs(epochMs, zone);
  const epochDay = Math.floor(local / MS_PER_DAY);
  return {
    date: fromEpochDay(epochDay),
    minuteOfDay: Math.floor((local - epochDay * MS_PER_DAY) / MS_PER_MINUTE),
  };
}

/** The local calendar day an instant falls on in a zone. */
export function localDateOf(epochMs: number, zone: TimeZone): LocalDate {
  return epochToZonedWallClock(epochMs, zone).date;
}

/**
 * The first instant of a local day. Where midnight does not exist (some zones
 * switch at midnight) this is the first real instant of that day.
 */
export function startOfLocalDay(date: LocalDate, zone: TimeZone): number {
  return zonedTimeToEpoch(date, 0, zone);
}
