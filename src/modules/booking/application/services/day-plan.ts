import { MS_PER_MINUTE } from '@lib/utils';

import { formatInstantInZone } from '../../domain/time/instant-format';
import { addLocalDays } from '../../domain/time/local-date';
import { startOfLocalDay } from '../../domain/time/local-time-resolution';

import type { Booking } from '../../domain/models/booking';
import type { Instant } from '../../domain/time/instant';
import type { LocalDate } from '../../domain/time/local-date';
import type { TimeInterval } from '../../domain/time/time-interval';
import type { TimeZone } from '../../domain/time/time-zone';
import type { DayPlanPhase, WorkdayView } from '../contracts/employee-views';

/** One local day as instants: it ends where the next one starts (23, 24 or 25 hours). */
export function daySpan(date: LocalDate, zone: TimeZone): TimeInterval {
  return { start: startOfLocalDay(date, zone), end: startOfLocalDay(addLocalDays(date, 1), zone) };
}

/**
 * Where a booking stands against the clock. Completed and no-show are what was recorded; the rest is
 * read from `now` (half-open: a booking ending at 10:00 is over at 10:00). Not a status (BD-04).
 */
export function phaseOf(booking: Booking, now: Instant): DayPlanPhase {
  if (booking.status === 'completed') {
    return 'done';
  }
  if (booking.status === 'no_show') {
    return 'missed';
  }
  if (booking.end <= now) {
    return 'past';
  }
  return booking.start <= now ? 'now' : 'upcoming';
}

/** The earliest booking that has not started, and in how many whole minutes (rounded up) it does. */
export function nextOf(
  bookings: readonly Booking[],
  now: Instant,
): { readonly bookingId: string; readonly minutesUntil: number } | null {
  const next = bookings
    .filter((booking) => booking.status === 'confirmed' && booking.start > now)
    .reduce<Booking | null>(
      (earliest, booking) =>
        earliest === null || booking.start < earliest.start ? booking : earliest,
      null,
    );
  return next === null
    ? null
    : { bookingId: next.id, minutesUntil: Math.ceil((next.start - now) / MS_PER_MINUTE) };
}

/**
 * The working day an employee has: from the first window's start to the last window's end, and the
 * gaps between windows as the breaks (the hours subtract breaks, so a break is what lies between two
 * windows). `null` on a day off.
 */
export function workdayOf(windows: readonly TimeInterval[], zone: TimeZone): WorkdayView | null {
  const first = windows[0];
  const last = windows.at(-1);
  if (first === undefined || last === undefined) {
    return null;
  }
  return {
    start: formatInstantInZone(first.start, zone),
    end: formatInstantInZone(last.end, zone),
    breaks: windows.flatMap((window, index) => {
      const next = windows[index + 1];
      return next === undefined
        ? []
        : [
            {
              start: formatInstantInZone(window.end, zone),
              end: formatInstantInZone(next.start, zone),
            },
          ];
    }),
  };
}
