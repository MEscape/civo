import { WEEKDAYS } from '../scheduling/weekly-hours';

import type { TimeRange, WeeklyHours } from '../scheduling/weekly-hours';
import type { Weekday } from '../time/local-date';

/**
 * An employee's calendar is a `BookableResource` of type `employee` that names its member: one per
 * member, at one location (EX-19). The person keeps their own working hours and absences; a manager
 * can change them too, and grants qualifications (BD-06). What a manager changed is told to the
 * employee as a message like any other (`CalendarNotice`), so nobody is changed behind their back.
 */

/** The parts of a calendar a manager can change for the employee. */
export const MANAGER_CHANGE_PARTS = [
  'setup',
  'hours',
  'absences',
  'qualifications',
  'coverage',
] as const;
export type ManagerChangePart = (typeof MANAGER_CHANGE_PARTS)[number];

/** Whether `range` lies inside the union of `open` (ranges that touch join up). */
function isCovered(open: readonly TimeRange[], range: TimeRange): boolean {
  let reach = range.startMinute;
  for (const window of [...open].sort((a, b) => a.startMinute - b.startMinute)) {
    if (window.startMinute <= reach && window.endMinute > reach) {
      reach = window.endMinute;
    }
  }
  return reach >= range.endMinute;
}

/**
 * The weekdays on which an employee would work while the location is closed: a working range that
 * is not inside the location's opening ranges that day. The location's breaks do not count against
 * it (the engine leaves them out anyway); its dated exceptions are not looked at.
 */
export function daysOutsideLocation(own: WeeklyHours, location: WeeklyHours): Weekday[] {
  return WEEKDAYS.filter((weekday) =>
    own[weekday].ranges.some((range) => !isCovered(location[weekday].ranges, range)),
  );
}
