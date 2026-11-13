import { addDays, unique } from '@lib/utils';

/**
 * Calendar arithmetic for the visitor's date picker, on plain `YYYY-MM-DD` days of the location's
 * calendar (a month is `YYYY-MM`). No zone takes part: the days come from the server (the
 * location's "today", the slots' starts on its wall clock), and only whole days are counted here.
 */

const MONTHS_PER_YEAR = 12;
const DAYS_PER_WEEK = 7;
/** `getUTCDay` counts from Sunday; the week here starts on Monday. */
const SUNDAY_LAST = DAYS_PER_WEEK - 1;
const NOON_UTC = 12;
const MIDDLE_OF_MONTH = 15;
const MONTH_TEXT = 'YYYY-MM'.length;
const DAY_TEXT = 'YYYY-MM-DD'.length;
const DATE_AT = 'YYYY-MM-'.length;

const pad = (value: number) => String(value).padStart(2, '0');

function partsOf(text: string) {
  const [year = 1970, month = 1, date = 1] = text.split('-').map(Number);
  return { year, month, date };
}

/** Noon UTC of a day: the same calendar day whatever the machine's zone. */
function noonOf(day: string): Date {
  const { year, month, date } = partsOf(day);
  return new Date(Date.UTC(year, month - 1, date, NOON_UTC));
}

/** The month a day is in. */
export const monthOf = (day: string) => day.slice(0, MONTH_TEXT);

/** The calendar day of a start as the views carry it (ISO text on the location's wall clock). */
export const dayOf = (instant: string) => instant.slice(0, DAY_TEXT);

/** The day of the month, `12` for `2027-01-12`. */
export const dateNumberOf = (day: string) => Number(day.slice(DATE_AT));

/** The day `days` after `day`. */
export const dayAfter = (day: string, days: number) =>
  dayOf(addDays(noonOf(day), days).toISOString());

/** The month `delta` months after `month`. */
export function shiftMonth(month: string, delta: number): string {
  const { year, month: number } = partsOf(month);
  const index = year * MONTHS_PER_YEAR + number - 1 + delta;
  return `${Math.floor(index / MONTHS_PER_YEAR)}-${pad((index % MONTHS_PER_YEAR) + 1)}`;
}

/** Every day of a month, in order. */
export function daysOfMonth(month: string): string[] {
  const { year, month: number } = partsOf(month);
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return Array.from({ length: count }, (_, index) => `${month}-${pad(index + 1)}`);
}

/** The column of the 1st in a week that starts on Monday, from 1. */
export function firstColumnOf(month: string): number {
  return ((noonOf(`${month}-01`).getUTCDay() + SUNDAY_LAST) % DAYS_PER_WEEK) + 1;
}

/** The days of a month that are worth asking about: from `today` (or the 1st) to the last. */
export function monthSpan(
  month: string,
  today: string,
): { readonly from: string; readonly to: string } | null {
  const days = daysOfMonth(month);
  const first = days[0] ?? today;
  const last = days.at(-1) ?? today;
  if (last < today) {
    return null;
  }
  return { from: first < today ? today : first, to: last };
}

/** Noon of the 15th: a moment that lies in the month in every zone, to name the month by. */
export const middleOf = (month: string) => noonOf(`${month}-${MIDDLE_OF_MONTH}`);

/**
 * The days of `month` an answer of free starts says something is free on. shortcut: a cut-short
 * answer (thousands of starts) leaves the days after its last one open to choose, and the day's own
 * times answer for them; ask per week if that ever confuses.
 */
export function freeDaysOf(
  month: string,
  answer: {
    readonly slots: ReadonlyArray<{ readonly start: string }>;
    readonly isTruncated: boolean;
  },
): string[] {
  const days = unique(answer.slots.map((slot) => dayOf(slot.start)));
  const lastDay = days.at(-1);
  const unread =
    answer.isTruncated && lastDay !== undefined
      ? daysOfMonth(month).filter((day) => day > lastDay)
      : [];
  return [...days, ...unread];
}
