import { dayAfter, monthOf, shiftMonth } from './month-calendar';

import type { CalendarView } from '../schemas/parse-booking-list-input';

/**
 * The days a calendar view shows, as `YYYY-MM-DD` on the locations' calendar: whole-day arithmetic,
 * no zone. Weeks start on Monday; a month is the six weeks of its grid, so at most 42 days are asked
 * for, the bound of the calendar's query.
 */

const DAYS_PER_WEEK = 7;
const MONTH_GRID_DAYS = 42;
/** `getUTCDay` counts from Sunday; this many days on, Monday is 0. */
const SUNDAY_TO_MONDAY = 6;
/** `YYYY-MM-DDTHH:mm:ss`: the wall clock, without the offset. */
const WALL_CLOCK_TEXT = 19;

/** ISO weekday of a day, Monday = 0. */
function mondayOffset(day: string): number {
  const [year = 1970, month = 1, date = 1] = day.split('-').map(Number);
  return (new Date(Date.UTC(year, month - 1, date)).getUTCDay() + SUNDAY_TO_MONDAY) % DAYS_PER_WEEK;
}

const mondayOf = (day: string) => dayAfter(day, -mondayOffset(day));

export interface CalendarDays {
  readonly from: string;
  readonly to: string;
}

export function calendarDays(view: CalendarView, anchor: string): CalendarDays {
  switch (view) {
    case 'day':
      return { from: anchor, to: anchor };
    case 'week':
    case 'list':
      return { from: mondayOf(anchor), to: dayAfter(mondayOf(anchor), DAYS_PER_WEEK - 1) };
    case 'month': {
      const first = mondayOf(`${monthOf(anchor)}-01`);
      return { from: first, to: dayAfter(first, MONTH_GRID_DAYS - 1) };
    }
  }
}

/** The day the period before (`-1`) or after (`1`) contains. */
export function shiftAnchor(view: CalendarView, anchor: string, direction: -1 | 1): string {
  switch (view) {
    case 'day':
      return dayAfter(anchor, direction);
    case 'week':
    case 'list':
      return dayAfter(anchor, direction * DAYS_PER_WEEK);
    case 'month':
      return `${shiftMonth(monthOf(anchor), direction)}-01`;
  }
}

/** A booking's start or end as the calendar draws it: the wall clock of its location, without the offset. */
export const wallClockOf = (instant: string) => instant.slice(0, WALL_CLOCK_TEXT);

/** How a day (`YYYY-MM-DD`) is written for a set of date-format options: the caller's own formatter, so the language and the time zone are the app's. */
export type DayFormatter = (day: string, options: Intl.DateTimeFormatOptions) => string;

/**
 * What the calendar's header calls the period it shows: the day in full, the month by name (the grid
 * also draws the days of the weeks around it, which are not the period), a week or a list as its first
 * and last day.
 */
export function periodLabel(
  view: CalendarView,
  input: { readonly anchor: string; readonly from: string; readonly to: string },
  formatDay: DayFormatter,
): string {
  switch (view) {
    case 'day':
      return formatDay(input.from, { dateStyle: 'full' });
    case 'month':
      return formatDay(input.anchor, { month: 'long', year: 'numeric' });
    case 'week':
    case 'list':
      return `${formatDay(input.from, { dateStyle: 'medium' })} – ${formatDay(input.to, { dateStyle: 'medium' })}`;
  }
}
