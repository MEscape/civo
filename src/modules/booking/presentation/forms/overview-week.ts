import { dayAfter, dayOf } from './month-calendar';

import type { BookingView } from '../../application/contracts/booking-views';

/** One day of the overview's chart: the confirmed bookings that start in it, by whether an employee still has to be found. */
export interface WeekDay {
  /** `YYYY-MM-DD` on the locations' calendar. */
  readonly day: string;
  /** Confirmed, and some employee place is still empty. */
  readonly waiting: number;
  /** Confirmed, and every employee place is taken. */
  readonly covered: number;
}

/** The days of the week the overview draws. */
export const WEEK_DAYS = 7;

/**
 * The confirmed bookings of `days` days from `from`, counted per day (a day without any is a zero,
 * so the chart always shows the whole period). Held, cancelled and finished bookings are not work
 * that is still ahead and are left out.
 */
export function weekOf(
  items: ReadonlyArray<Pick<BookingView, 'start' | 'status' | 'assignment'>>,
  from: string,
  days: number = WEEK_DAYS,
): WeekDay[] {
  const counts = new Map<string, { waiting: number; covered: number }>();
  for (const { start, status, assignment } of items) {
    if (status !== 'confirmed') {
      continue;
    }
    const day = dayOf(start);
    const count = counts.get(day) ?? { waiting: 0, covered: 0 };
    if (assignment === 'open') {
      count.waiting += 1;
    } else {
      count.covered += 1;
    }
    counts.set(day, count);
  }
  return Array.from({ length: days }, (_, offset) => {
    const day = dayAfter(from, offset);
    return { day, waiting: counts.get(day)?.waiting ?? 0, covered: counts.get(day)?.covered ?? 0 };
  });
}
