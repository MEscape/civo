import { insertItem, removeAt, replaceAt } from '@lib/utils';

import { readableRanges, timeOf } from './time';

import type { Minutes } from './time';
import type { DayDto, RangeDto } from '../../dto/location-dto';

/**
 * A week of `HH:mm` text as the editor holds it while someone types. Nothing here decides what is
 * valid or bookable: the form is checked by the server's own rules, and a time that does not read
 * simply counts as nothing in the editor's arithmetic.
 */
export type WeekDraft = readonly DayDto[];

/** The name each weekday goes by in the catalogs, Monday first. */
export const WEEKDAY_IDS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type WeekdayId = (typeof WEEKDAY_IDS)[number];

/** The id of the weekday at a position of the week (0 is Monday); positions come from a week of seven days. */
export function weekdayId(index: number): WeekdayId {
  return WEEKDAY_IDS[index] ?? 'mon';
}

export const CLOSED_DAY: DayDto = { intervals: [], breaks: [] };

const WORKING_DAY: RangeDto = { start: '08:00', end: '17:00' };
const BLANK_RANGE: RangeDto = { start: '', end: '' };
const NOON_BREAK: RangeDto = { start: '12:00', end: '13:00' };
const NOON_START = 720;
const NOON_END = 780;
/** A break asked for without times is half an hour, on the quarter hours the bar moves in. */
const HALF_HOUR = 30;
const QUARTER_HOUR = 15;

export function updateDay(
  week: WeekDraft,
  index: number,
  update: (day: DayDto) => DayDto,
): DayDto[] {
  const day = week[index];
  return day === undefined ? [...week] : replaceAt(week, index, update(day));
}

/** A new range for a day: a working day when there is none yet, otherwise a blank row to fill in. */
export function addInterval(day: DayDto, limits?: readonly Minutes[]): DayDto {
  // Inside the place's opening stretches the first one is the day to start from, not one it is closed in.
  const first = limits?.[0];
  const working =
    first === undefined ? WORKING_DAY : { start: timeOf(first.start), end: timeOf(first.end) };
  const added = day.intervals.length === 0 ? working : BLANK_RANGE;
  return { ...day, intervals: insertItem(day.intervals, day.intervals.length, added) };
}

/**
 * A break to start from: the noon hour when the day is open then (or has no hours yet), otherwise
 * half an hour in the middle of the longest open stretch. A break outside the open hours is refused
 * on save, so a new one starts where it is valid.
 */
function breakFor(intervals: DayDto['intervals']): RangeDto {
  const open = readableRanges(intervals);
  if (open.length === 0 || open.some(({ start, end }) => start <= NOON_START && NOON_END <= end)) {
    return NOON_BREAK;
  }
  const longest = open.reduce((best, range) =>
    range.end - range.start > best.end - best.start ? range : best,
  );
  if (longest.end - longest.start < 2 * HALF_HOUR) {
    return NOON_BREAK;
  }
  const middle = Math.round((longest.start + longest.end) / 2 / QUARTER_HOUR) * QUARTER_HOUR;
  return { start: timeOf(middle - QUARTER_HOUR), end: timeOf(middle + QUARTER_HOUR) };
}

export function addBreak(day: DayDto): DayDto {
  return { ...day, breaks: insertItem(day.breaks, day.breaks.length, breakFor(day.intervals)) };
}

export function removeInterval(day: DayDto, index: number): DayDto {
  return { ...day, intervals: removeAt(day.intervals, index) };
}

export function removeBreak(day: DayDto, index: number): DayDto {
  return { ...day, breaks: removeAt(day.breaks, index) };
}

/** `source`'s day written over each of the `targets`. */
export function copyDay(week: WeekDraft, source: number, targets: readonly number[]): DayDto[] {
  const from = week[source];
  return week.map((day, position) =>
    from !== undefined && targets.includes(position) && position !== source ? from : day,
  );
}
