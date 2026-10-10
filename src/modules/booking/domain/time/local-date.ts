/**
 * A calendar date with no time and no zone ("2026-03-29").
 *
 * Opening hours, absences and booking horizons are statements about calendar
 * days in a place, not about instants, so scheduling reasons in `LocalDate`
 * and converts to an instant only through a time zone (`time-zone.ts`).
 * Arithmetic goes through the proleptic Gregorian epoch day, which never
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
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const MS_PER_DAY = 86_400_000;
const MIN_YEAR = 1970;
const MAX_YEAR = 2200;
const MONTHS_PER_YEAR = 12;
const DAYS_PER_WEEK = 7;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Whether the three numbers name a real calendar day inside the supported years. */
export function isValidLocalDate(year: number, month: number, day: number): boolean {
  return (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    year >= MIN_YEAR &&
    year <= MAX_YEAR &&
    month >= 1 &&
    month <= MONTHS_PER_YEAR &&
    day >= 1 &&
    day <= daysInMonth(year, month)
  );
}

/** Builds a date from its parts; `null` when they do not name a real day. */
export function createLocalDate(year: number, month: number, day: number): LocalDate | null {
  return isValidLocalDate(year, month, day) ? { year, month, day } : null;
}

/** Parses `YYYY-MM-DD`; `null` for anything else, including `2026-02-30`. */
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
  return `${pad(date.year, 4)}-${pad(date.month, 2)}-${pad(date.day, 2)}`;
}

/** Days since 1970-01-01. Two dates are compared and subtracted through this. */
export function toEpochDay(date: LocalDate): number {
  return Date.UTC(date.year, date.month - 1, date.day) / MS_PER_DAY;
}

export function fromEpochDay(epochDay: number): LocalDate {
  const utc = new Date(epochDay * MS_PER_DAY);
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() };
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromEpochDay(toEpochDay(date) + days);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return toEpochDay(to) - toEpochDay(from);
}

/** Negative, zero or positive, like a sort comparator. */
export function compareLocalDates(a: LocalDate, b: LocalDate): number {
  return toEpochDay(a) - toEpochDay(b);
}

export function isSameLocalDate(a: LocalDate, b: LocalDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

export function weekdayOf(date: LocalDate): Weekday {
  const sundayBased = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
  // 0 (Sunday) becomes 7; 1 (Monday) stays 1.
  const iso = sundayBased === 0 ? DAYS_PER_WEEK : sundayBased;
  return WEEKDAYS.find((weekday) => weekday === iso) ?? 1;
}

/** Every date from `from` to `to`, both included; empty when `to` precedes `from`. */
export function eachLocalDate(from: LocalDate, to: LocalDate): readonly LocalDate[] {
  const first = toEpochDay(from);
  const last = toEpochDay(to);
  const dates: LocalDate[] = [];
  for (let epochDay = first; epochDay <= last; epochDay += 1) {
    dates.push(fromEpochDay(epochDay));
  }
  return dates;
}
