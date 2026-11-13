import type { Brand } from '@lib/utils';

import { MAX_YEAR, MIN_YEAR, createLocalDate } from './local-date';
import { minutesToMs } from './minutes';

import type { Minutes } from './minutes';

/**
 * One moment on the UTC timeline, as whole epoch milliseconds. It names no zone and no calendar:
 * "09:00" is never an `Instant` until a time zone says where (`time-zone.ts`), because guessing the
 * server's zone is how appointments move.
 *
 * Instants are limited to the supported years, with a year of room on both sides: local midnight of
 * the first or last supported day is a different instant in every zone.
 */
export type Instant = Brand<number, 'Instant'>;

const MIN_INSTANT_MS = Date.UTC(MIN_YEAR - 1, 0, 1);
const MAX_INSTANT_MS = Date.UTC(MAX_YEAR + 2, 0, 1);

/**
 * An ISO-8601 instant that carries its offset or `Z`; an instant without one is refused. The groups
 * are year, month, day, hour, minute, optional second, and the offset's hour and minute.
 */
const INSTANT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-](\d{2}):(\d{2}))$/;

const MAX_HOUR = 23;
const MAX_MINUTE = 59;

/** `Date.parse` rolls an impossible day (`02-30`) over to the next month, so the parts are checked. */
function hasValidParts(match: RegExpExecArray): boolean {
  const [, year, month, day, hour, minute, second = '0', offsetHour = '0', offsetMinute = '0'] =
    match;
  return (
    createLocalDate(Number(year), Number(month), Number(day)) !== null &&
    Number(hour) <= MAX_HOUR &&
    Number(minute) <= MAX_MINUTE &&
    Number(second) <= MAX_MINUTE &&
    Number(offsetHour) <= MAX_HOUR &&
    Number(offsetMinute) <= MAX_MINUTE
  );
}

/** `null` unless `epochMs` is a whole number of milliseconds inside the supported range. */
export function toInstant(epochMs: number): Instant | null {
  const isInRange =
    Number.isInteger(epochMs) && epochMs >= MIN_INSTANT_MS && epochMs < MAX_INSTANT_MS;
  // Brand constructor: the cast is only permitted here.
  return isInRange ? (epochMs as Instant) : null;
}

/**
 * Types the result of arithmetic on instants that were already validated: a buffer or a notice is
 * at most a year, and a wall-clock time at most a day from its instant, which the year of room on
 * both sides of the supported range absorbs. Not for raw numbers from outside the time model:
 * those go through `toInstant`.
 */
export function asInstant(epochMs: number): Instant {
  // Brand constructor: the cast is only permitted here.
  return epochMs as Instant;
}

/** Parses ISO-8601 text that carries an offset or `Z`; `null` for anything else. */
export function parseInstant(text: string): Instant | null {
  const match = INSTANT_PATTERN.exec(text);
  return match !== null && hasValidParts(match) ? toInstant(Date.parse(text)) : null;
}

/** `null` for an invalid `Date` or one outside the supported range. */
export function instantFromDate(date: Date): Instant | null {
  return toInstant(date.getTime());
}

export function instantToDate(instant: Instant): Date {
  return new Date(instant);
}

export function addMinutes(instant: Instant, minutes: Minutes): Instant {
  return asInstant(instant + minutesToMs(minutes));
}

export function subtractMinutes(instant: Instant, minutes: Minutes): Instant {
  return asInstant(instant - minutesToMs(minutes));
}

export function laterOf(a: Instant, b: Instant): Instant {
  return a >= b ? a : b;
}
