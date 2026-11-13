import { isDefined, unique } from '@lib/utils';

import type { Booking } from './booking';
import type { ManagerChangePart } from './employee-calendar';
import type { BookableResourceId, BookableServiceId, BookingId, BookingLocationId } from './ids';
import type { Instant } from '../time/instant';

/**
 * What changed for an employee on a booking they serve (BD-11). A message is a type and the facts of
 * the booking as the change left it, never text: the screen words it in the reader's language, and
 * names are read when it is shown (a renamed service reads with its new name).
 */
export const MESSAGE_KINDS = ['assigned', 'unassigned', 'cancelled', 'rescheduled'] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

/** The one message that is about the calendar and not about a booking: a manager changed it. */
export const CALENDAR_CHANGED = 'calendar_changed';

/** Who is told what about a change: the employee is named by their calendar. */
export interface AssignmentNotice {
  readonly resourceId: BookableResourceId;
  readonly type: MessageKind;
}

/** A manager changed the employee's calendar: where, and which parts (never who, never the values). */
export interface CalendarNotice {
  readonly resourceId: BookableResourceId;
  readonly locationId: BookingLocationId;
  readonly parts: readonly ManagerChangePart[];
}

interface MessageBase {
  readonly id: string;
  readonly locationId: BookingLocationId;
  readonly createdAt: Instant;
  readonly readAt: Instant | null;
}

/** A message about a booking, as the inbox reads it. */
export interface BookingMessage extends MessageBase {
  readonly type: MessageKind;
  readonly bookingId: BookingId;
  readonly serviceId: BookableServiceId;
  readonly start: Instant;
  readonly end: Instant;
}

/** A message about the employee's own calendar. */
export interface CalendarMessage extends MessageBase {
  readonly type: typeof CALENDAR_CHANGED;
  readonly parts: readonly ManagerChangePart[];
}

export type ActorMessage = BookingMessage | CalendarMessage;

const employeesOf = (booking: Booking): BookableResourceId[] =>
  unique(
    booking.assignments
      .filter((unit) => unit.resourceType === 'employee')
      .map((unit) => unit.resourceId)
      .filter(isDefined),
  );

/**
 * The employees a change to a booking concerns, and what to tell each: taken on, taken off, the
 * booking cancelled, or moved to another time. Derived from the booking before and after, so a message
 * can only describe what the write really does. A booking that becomes confirmed (made by staff, or a
 * hold that was confirmed: `before` is `null` or a hold) tells the employees it already has that it is
 * theirs; a hold, a hold that runs out and the end of a booking (completed, no-show) tell nobody anything.
 */
export function assignmentNoticesOf(before: Booking | null, after: Booking): AssignmentNotice[] {
  if (before === null || before.status === 'held') {
    return after.status === 'confirmed'
      ? employeesOf(after).map((resourceId) => ({ resourceId, type: 'assigned' }))
      : [];
  }
  if (before.status !== 'confirmed') {
    return [];
  }
  const was = employeesOf(before);
  if (after.status === 'cancelled') {
    return was.map((resourceId) => ({ resourceId, type: 'cancelled' }));
  }
  if (after.status !== 'confirmed') {
    return [];
  }
  const is = employeesOf(after);
  const isMoved = before.start !== after.start || before.end !== after.end;
  return [
    ...is
      .filter((id) => !was.includes(id))
      .map((resourceId): AssignmentNotice => ({ resourceId, type: 'assigned' })),
    ...was
      .filter((id) => !is.includes(id))
      .map((resourceId): AssignmentNotice => ({ resourceId, type: 'unassigned' })),
    ...(isMoved
      ? is
          .filter((id) => was.includes(id))
          .map((resourceId): AssignmentNotice => ({ resourceId, type: 'rescheduled' }))
      : []),
  ];
}
