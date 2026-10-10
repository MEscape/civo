import { range, MS_PER_DAY } from '@lib/utils';

import {
  createLocalDate,
  formatLocalDate,
  toEpochDay,
  weekdayOf,
} from '../../application/contracts/booking-constraints';

const MONTHS_PER_YEAR = 12;
const DAYS_PER_WEEK = 7;

/** ISO weekday numbers, Monday (1) to Sunday (7): the column order of a month grid. */
export const WEEKDAYS_MONDAY_FIRST: readonly number[] = range(1, DAYS_PER_WEEK + 1);

export interface YearMonth {
  readonly year: number;
  readonly month: number;
}

/** `2026-10-12` -> `{ year: 2026, month: 10 }`; `null` when the text is not a date. */
export function yearMonthOf(localDate: string): YearMonth | null {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(localDate);
  return match === null ? null : { year: Number(match[1]), month: Number(match[2]) };
}

export function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * MONTHS_PER_YEAR + (month - 1) + delta;
  return { year: Math.floor(index / MONTHS_PER_YEAR), month: (index % MONTHS_PER_YEAR) + 1 };
}

export function compareYearMonth(a: YearMonth, b: YearMonth): number {
  return a.year * MONTHS_PER_YEAR + a.month - (b.year * MONTHS_PER_YEAR + b.month);
}

function dateText(year: number, month: number, day: number): string | null {
  const date = createLocalDate(year, month, day);
  return date === null ? null : formatLocalDate(date);
}

export function firstDayOf(target: YearMonth): string {
  return (
    dateText(target.year, target.month, 1) ??
    `${target.year}-${String(target.month).padStart(2, '0')}-01`
  );
}

/** The number of days in a month, found as the distance to the first day of the next one. */
export function daysInMonth(target: YearMonth): number {
  const first = createLocalDate(target.year, target.month, 1);
  const next = shiftMonth(target, 1);
  const following = createLocalDate(next.year, next.month, 1);
  if (first === null || following === null) {
    return 0;
  }
  return toEpochDay(following) - toEpochDay(first);
}

export function lastDayOf(target: YearMonth): string {
  return (
    dateText(target.year, target.month, daysInMonth(target)) ??
    `${target.year}-${String(target.month).padStart(2, '0')}-28`
  );
}

/**
 * The cells of a Monday-first month grid: `null` pads the week before the
 * first day, then every day of the month as `YYYY-MM-DD`.
 */
export function monthCells(target: YearMonth): ReadonlyArray<string | null> {
  const first = createLocalDate(target.year, target.month, 1);
  if (first === null) {
    return [];
  }
  const padding = weekdayOf(first) - 1;
  const days: Array<string | null> = Array.from({ length: padding }, () => null);
  for (let day = 1; day <= daysInMonth(target); day += 1) {
    days.push(dateText(target.year, target.month, day));
  }
  return days;
}

/** The current month in UTC. The location's own "today" can differ by a day at a month boundary; availability itself is always decided on the server. */
export function currentYearMonth(): YearMonth {
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

/** The month that contains the day `days` from now, in UTC. Used to stop paging past the booking horizon. */
export function yearMonthAfterDays(days: number): YearMonth {
  const later = new Date(Date.now() + days * MS_PER_DAY);
  return { year: later.getUTCFullYear(), month: later.getUTCMonth() + 1 };
}
