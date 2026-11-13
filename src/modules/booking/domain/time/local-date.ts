import { MS_PER_DAY } from '@lib/utils';

/**
 * A calendar date with no time and no zone ("2027-03-28").
 *
 * Opening hours, absences and booking horizons are statements about calendar days in a place, not
 * about instants, so scheduling reasons in `LocalDate` and reaches an instant only through a time
 * zone (`time-zone.ts`). Arithmetic goes through the proleptic Gregorian epoch day, which never
 * depends on the machine's zone or on daylight saving.
 */
export interface LocalDate {
  readonly year: number;
  /** 1 (January) to 12. */
  readonly month: number;
  /** 1 to the length of the month. */
  readonly day: number;
}

/** ISO weekday: 1 is Monday, 7 is Sunday. */
// eslint-disable-next-line no-magic-numbers -- the ISO 8601 weekday numbers are the definition itself
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** The years the scheduling engine supports; instants and dates outside them are refused. */
export const MIN_YEAR = 1970;
export const MAX_YEAR = 2200;

const MONTHS_PER_YEAR = 12;
const YEAR_DIGITS = 4;
const SUNDAY = 0;
const ISO_SUNDAY = 7;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Builds a date from its parts; `null` when they do not name a real day in the supported years. */
export function createLocalDate(year: number, month: number, day: number): LocalDate | null {
  const isReal =
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    year >= MIN_YEAR &&
    year <= MAX_YEAR &&
    month >= 1 &&
    month <= MONTHS_PER_YEAR &&
    day >= 1 &&
    day <= daysInMonth(year, month);
  return isReal ? { year, month, day } : null;
}

/** Parses `YYYY-MM-DD`; `null` for anything else, including `2027-02-29`. */
export function parseLocalDate(text: string): LocalDate | null {
  const match = ISO_DATE_PATTERN.exec(text);
  if (match === null) {
    return null;
  }
  const [, year, month, day] = match;
  return createLocalDate(Number(year), Number(month), Number(day));
}

export function formatLocalDate(date: LocalDate): string {
  const pad = (value: number, length: number) => String(value).padStart(length, '0');
  return `${pad(date.year, YEAR_DIGITS)}-${pad(date.month, 2)}-${pad(date.day, 2)}`;
}

/** Days since 1970-01-01. Dates are compared and subtracted through this. */
export function toEpochDay(date: LocalDate): number {
  return Date.UTC(date.year, date.month - 1, date.day) / MS_PER_DAY;
}

export function fromEpochDay(epochDay: number): LocalDate {
  const utc = new Date(epochDay * MS_PER_DAY);
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() };
}

/** Calendar arithmetic; the caller keeps the result within the supported years. */
export function addLocalDays(date: LocalDate, days: number): LocalDate {
  return fromEpochDay(toEpochDay(date) + days);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return toEpochDay(to) - toEpochDay(from);
}

export function weekdayOf(date: LocalDate): Weekday {
  const sundayBased = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
  // 0 (Sunday) becomes 7; 1 (Monday) to 6 (Saturday) stay. `getUTCDay` is 0 to 6, so the cast
  // only names what the check above has left: 1 to 6.
  return sundayBased === SUNDAY ? ISO_SUNDAY : (sundayBased as Weekday);
}
