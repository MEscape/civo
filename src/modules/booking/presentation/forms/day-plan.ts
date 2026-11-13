import { MS_PER_DAY } from '@lib/utils';

import type { DayPlanDto, DayPlanItemDto } from '../dto/employee-dto';

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_TEXT_LENGTH = 10;

/**
 * The calendar day `days` after `date` (`YYYY-MM-DD`), counted on the calendar, not in hours, so a
 * day of 23 or 25 hours is still one day. Text that is not a day stays as it is.
 */
export function shiftDay(date: string, days: number): string {
  const match = DAY.exec(date);
  if (match === null) {
    return date;
  }
  const [, year, month, day] = match;
  const shifted = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day)) + days * MS_PER_DAY,
  );
  return shifted.toISOString().slice(0, DAY_TEXT_LENGTH);
}

/** How many bookings of the day are done: the progress the plan shows. */
export function doneCount(items: readonly DayPlanItemDto[]): number {
  return items.filter((item) => item.phase === 'done').length;
}

/** The break (if any) that lies between two appointments of the day, as it is entered in the working hours. */
export function breakBetween(
  plan: Pick<DayPlanDto, 'workday'>,
  previous: DayPlanItemDto | undefined,
  next: DayPlanItemDto,
) {
  if (previous === undefined || plan.workday === null) {
    return undefined;
  }
  const from = Date.parse(previous.booking.end);
  const to = Date.parse(next.booking.start);
  return plan.workday.breaks.find(
    (pause) => Date.parse(pause.start) >= from && Date.parse(pause.end) <= to,
  );
}
