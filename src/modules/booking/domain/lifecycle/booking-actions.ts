import type { ConflictAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import { BOOKING_ERROR_CODES, bookingConflict } from '../errors/booking-errors';

import type { Booking, BookingStatus } from '../models/booking';

/**
 * Everything that can be done to a booking. Most keep its status; five move it:
 *
 *   held ──confirm──▶ confirmed ──complete──▶ completed
 *     │                   │  └──mark-no-show──▶ no_show
 *     ├──expire──▶ expired│
 *     └──cancel──▶ cancelled ◀──cancel──┘
 *
 * `reschedule`, `assign` and `unassign` keep `confirmed`: a booking never stops existing when it
 * moves, so its owner keeps it and there is no moment when the old time is released and the new
 * one is not yet held.
 */
export const BOOKING_ACTIONS = [
  'confirm',
  'expire',
  'cancel',
  'reschedule',
  'complete',
  'mark-no-show',
  'assign',
  'unassign',
] as const;
export type BookingAction = (typeof BOOKING_ACTIONS)[number];

/** The status an action leads to, for the actions that change it. */
const RESULT_STATUS: Readonly<Partial<Record<BookingAction, BookingStatus>>> = {
  confirm: 'confirmed',
  expire: 'expired',
  cancel: 'cancelled',
  complete: 'completed',
  'mark-no-show': 'no_show',
};

/**
 * What may be done in each status: the one table every lifecycle rule reads. A hold is not a
 * commitment yet, so it can only be confirmed, abandoned or left to expire; employees are assigned
 * to a booking that stands. The statuses without actions are terminal.
 */
export const ACTIONS_BY_STATUS: Readonly<Record<BookingStatus, readonly BookingAction[]>> = {
  held: ['confirm', 'expire', 'cancel'],
  confirmed: ['cancel', 'reschedule', 'complete', 'mark-no-show', 'assign', 'unassign'],
  cancelled: [],
  completed: [],
  no_show: [],
  expired: [],
};

export function isActionAllowed(status: BookingStatus, action: BookingAction): boolean {
  return ACTIONS_BY_STATUS[status].includes(action);
}

/** Whether some action leads from `from` to `to`. */
export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return ACTIONS_BY_STATUS[from].some((action) => RESULT_STATUS[action] === to);
}

/** A terminal status has no action: nothing can happen to the booking any more. */
export function isTerminal(status: BookingStatus): boolean {
  return ACTIONS_BY_STATUS[status].length === 0;
}

/** Fails with the lifecycle error when the booking's status does not allow `action`. */
export function requireAction(
  booking: Booking,
  action: BookingAction,
): AppResult<true, ConflictAppError> {
  return isActionAllowed(booking.status, action)
    ? ok(true)
    : err(
        bookingConflict(
          BOOKING_ERROR_CODES.invalidStateTransition,
          `The action "${action}" is not possible for a ${booking.status} booking.`,
        ),
      );
}
