import { daysBetween } from '../time/local-date';
import { MINUTES_PER_DAY } from '../time/time-of-day';
import { wallClockOf } from '../time/time-zone';

import type { EmployeePreferences } from '../models/employee-preferences';
import type { BookableServiceId } from '../models/ids';
import type { TimeInterval } from '../time/time-interval';
import type { TimeZone } from '../time/time-zone';

/**
 * How well a booking suits an employee's preferences, best first. Proposed decision BD-07, read
 * from the employee and manager screens. An employee can say which services and which part of the
 * day they prefer; where they work is not a preference (a calendar has one location, and a manager
 * sends them elsewhere), so the booking's place is not part of it.
 *  - `very-good`: everything the employee said anything about fits (the service, the time);
 *  - `good`: some of it fits;
 *  - `possible`: none of it fits, or nothing was said. The employee is qualified, so it is still on offer.
 */
export const FIT_LEVELS = ['very-good', 'good', 'possible'] as const;
export type FitLevel = (typeof FIT_LEVELS)[number];

/** Why a booking fits as it does. A "not" reason is only given where the employee expressed a preference. */
export type FitReason =
  'service-preferred' | 'service-not-preferred' | 'time-in-window' | 'time-outside-window';

export interface Fit {
  readonly level: FitLevel;
  readonly reasons: readonly FitReason[];
  readonly isServicePreferred: boolean;
  readonly isTimeInWindow: boolean;
}

/** The facts of a booking that preferences speak about. */
export interface FitSubject {
  readonly serviceId: BookableServiceId;
  readonly appointment: TimeInterval;
  /** The zone of the booking's location: the window is a part of ITS day. */
  readonly zone: TimeZone;
}

/** Whether the whole appointment lies inside the preferred part of one local day. */
function isInWindow(
  window: NonNullable<EmployeePreferences['window']>,
  appointment: TimeInterval,
  zone: TimeZone,
): boolean {
  const start = wallClockOf(appointment.start, zone);
  const end = wallClockOf(appointment.end, zone);
  const dayOffset = daysBetween(start.date, end.date);
  // Ending exactly at the next midnight is the end of this day.
  const endMinute = dayOffset === 1 && end.minuteOfDay === 0 ? MINUTES_PER_DAY : end.minuteOfDay;
  const sameDay = dayOffset === 0 || (dayOffset === 1 && end.minuteOfDay === 0);
  return sameDay && start.minuteOfDay >= window.startMinute && endMinute <= window.endMinute;
}

/** What an employee said, and how this booking relates to it, per dimension. */
interface Dimensions {
  readonly isServicePreferred: boolean;
  readonly hasServices: boolean;
  readonly isTimeInWindow: boolean;
  readonly hasWindow: boolean;
}

function dimensionsOf(preferences: EmployeePreferences | null, subject: FitSubject): Dimensions {
  const window = preferences?.window ?? null;
  return {
    isServicePreferred: preferences?.serviceIds.includes(subject.serviceId) ?? false,
    hasServices: (preferences?.serviceIds.length ?? 0) > 0,
    isTimeInWindow: window !== null && isInWindow(window, subject.appointment, subject.zone),
    hasWindow: window !== null,
  };
}

/** One reason per dimension: a positive one when it fits, a negative one only where something was said. */
function reasonsOf(d: Dimensions): FitReason[] {
  const reasons: FitReason[] = [];
  if (d.isServicePreferred) {
    reasons.push('service-preferred');
  } else if (d.hasServices) {
    reasons.push('service-not-preferred');
  }
  if (d.isTimeInWindow) {
    reasons.push('time-in-window');
  } else if (d.hasWindow) {
    reasons.push('time-outside-window');
  }
  return reasons;
}

function levelOf(d: Dimensions): FitLevel {
  const said = Number(d.hasServices) + Number(d.hasWindow);
  const met = Number(d.isServicePreferred) + Number(d.isTimeInWindow);
  if (met === 0) {
    return 'possible';
  }
  return met === said ? 'very-good' : 'good';
}

/**
 * Compares a booking with an employee's preferences. Pure and deterministic. `null` preferences
 * (an employee who never set any) give `possible` with no reasons. Preferences never exclude: this
 * answers "how well", never "whether".
 */
export function assessFit(preferences: EmployeePreferences | null, subject: FitSubject): Fit {
  const dimensions = dimensionsOf(preferences, subject);
  return {
    level: levelOf(dimensions),
    reasons: reasonsOf(dimensions),
    isServicePreferred: dimensions.isServicePreferred,
    isTimeInWindow: dimensions.isTimeInWindow,
  };
}
