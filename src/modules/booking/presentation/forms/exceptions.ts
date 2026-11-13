import { holidayKeysOn, publicHolidaysOf } from '../../application/contracts/booking-constraints';

import { CLOSED_DAY } from './week/draft';

import type { GermanRegion, HolidayKey } from '../../application/contracts/booking-constraints';
import type { ExceptionInputDto } from '../dto/location-dto';

/** What the grouping reads of an exception: its kind and the days it covers. */
export type ExceptionFacts = Pick<ExceptionInputDto, 'kind' | 'from' | 'to'>;

/** Which part of the list of exceptions a row belongs to. */
export const EXCEPTION_TABS = ['all', 'holidays', 'special', 'closures'] as const;
export type ExceptionTab = (typeof EXCEPTION_TABS)[number];

/**
 * A closure on one day that a state keeps as a holiday is a holiday; other hours (or extra hours) on a
 * day are special hours; any other closure, one day or many, is a closure. Read from the data: nothing
 * is stored to say so.
 */
export function tabOf(exception: ExceptionFacts): Exclude<ExceptionTab, 'all'> {
  if (exception.kind !== 'closed') {
    return 'special';
  }
  const isHoliday = exception.from === exception.to && holidayKeysOn(exception.from).length > 0;
  return isHoliday ? 'holidays' : 'closures';
}

export interface ExceptionRow {
  readonly exception: ExceptionInputDto;
  /** Where the row is in the form's list; the list keeps the order it was typed in. */
  readonly index: number;
}

/** The rows of a tab, earliest first (a row still blank sorts last), each with its place in the list. */
export function rowsOf(list: readonly ExceptionInputDto[], tab: ExceptionTab): ExceptionRow[] {
  return list
    .map((exception, index) => ({ exception, index }))
    .filter(({ exception }) => tab === 'all' || tabOf(exception) === tab)
    .sort((a, b) => {
      const blank = (text: string) => (text === '' ? '9999-99-99' : text);
      return blank(a.exception.from).localeCompare(blank(b.exception.from)) || a.index - b.index;
    });
}

export function countsOf(list: readonly ExceptionFacts[]): Record<ExceptionTab, number> {
  return {
    all: list.length,
    holidays: list.filter((exception) => tabOf(exception) === 'holidays').length,
    special: list.filter((exception) => tabOf(exception) === 'special').length,
    closures: list.filter((exception) => tabOf(exception) === 'closures').length,
  };
}

const isCovered = (exception: ExceptionInputDto, date: string) =>
  exception.from !== '' && exception.from <= date && date <= exception.to;

/**
 * The holidays of a state in a year added as closures, except on days an exception already covers
 * (a day somebody entered is never overwritten, and importing twice adds nothing). Easter-relative
 * holidays come out on the dates of that year, not the dates of another.
 */
export function withHolidays(
  list: readonly ExceptionInputDto[],
  region: GermanRegion,
  year: number,
): { readonly next: ExceptionInputDto[]; readonly added: number } {
  const additions = publicHolidaysOf(region, year)
    .filter(({ date }) => !list.some((exception) => isCovered(exception, date)))
    .map(({ date }): ExceptionInputDto => ({ kind: 'closed', from: date, to: date }));
  return { next: [...list, ...additions], added: additions.length };
}

/** A new row to fill in: a closure with no days yet. */
export const BLANK_EXCEPTION: ExceptionInputDto = { kind: 'closed', from: '', to: '' };

/** The holiday a one-day closure falls on, by its key, when the closure is entered on one. */
export function holidayOf(exception: ExceptionFacts): HolidayKey | undefined {
  const isOneDayClosure =
    exception.kind === 'closed' && exception.from !== '' && exception.from === exception.to;
  return isOneDayClosure ? holidayKeysOn(exception.from)[0] : undefined;
}

/** The exception as another kind: other hours bring a day to fill in, a closure has none. */
export function withKind(
  exception: ExceptionInputDto,
  kind: ExceptionInputDto['kind'],
): ExceptionInputDto {
  const { from, to } = exception;
  return kind === 'closed'
    ? { kind, from, to }
    : { kind, from, to, day: exception.day ?? CLOSED_DAY };
}

/** The exception starting on another day. A day entered alone stays one day until a later "until" is chosen. */
export function withFrom(exception: ExceptionInputDto, from: string): ExceptionInputDto {
  const isSingleDay = exception.to === '' || exception.to === exception.from;
  return { ...exception, from, to: isSingleDay ? from : exception.to };
}
