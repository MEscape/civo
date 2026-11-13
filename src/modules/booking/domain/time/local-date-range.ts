import { range } from '@lib/utils';

import { addLocalDays, daysBetween } from './local-date';

import type { LocalDate } from './local-date';

/** A span of local calendar days, both ends included. Built only by `createLocalDateRange`. */
export interface LocalDateRange {
  readonly from: LocalDate;
  readonly to: LocalDate;
}

/**
 * `null` when `to` precedes `from` or the range is longer than `maxDays` days. The bound is the
 * caller's, because how far one question may reach is a rule of the question (an availability
 * query, a calendar page), not of calendars.
 */
export function createLocalDateRange(
  from: LocalDate,
  to: LocalDate,
  maxDays: number,
): LocalDateRange | null {
  const days = daysBetween(from, to) + 1;
  return days >= 1 && days <= maxDays ? { from, to } : null;
}

/** Every date of the range, earliest first. */
export function datesOf(dates: LocalDateRange): readonly LocalDate[] {
  return range(0, daysBetween(dates.from, dates.to) + 1).map((offset) =>
    addLocalDays(dates.from, offset),
  );
}
