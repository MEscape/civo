import { describe, expect, it } from 'vitest';

import { BOOKING_ERROR_CODES as CODES } from '@modules/booking/domain/errors/booking-errors';
import {
  ACTIONS_BY_STATUS,
  BOOKING_ACTIONS,
  canTransition,
  isActionAllowed,
  isTerminal,
} from '@modules/booking/domain/lifecycle/booking-actions';
import { isHoldExpired } from '@modules/booking/domain/lifecycle/booking-hold';
import { findInvariantViolations } from '@modules/booking/domain/lifecycle/booking-invariants';
import {
  cancelBooking,
  completeBooking,
  markNoShow,
  rescheduleBooking,
} from '@modules/booking/domain/lifecycle/booking-lifecycle';
import { BOOKING_STATUSES, isBlocking } from '@modules/booking/domain/models/booking';
import { addMinutes } from '@modules/booking/domain/time/instant';

import {
  MONDAY,
  NOW,
  allowedPolicy,
  makeBooking,
  makeService,
  minutes,
  slotAt,
  unitOf,
} from '../support/booking-fixtures';
import { at, unwrap } from '../support/time-fixtures';

function codeOf(result: { isErr(): boolean; error?: { code: string } }): string | undefined {
  return result.isErr() ? result.error?.code : undefined;
}

describe('the status table', () => {
  it('lets a hold be confirmed, abandoned or left to expire, and nothing else', () => {
    expect(ACTIONS_BY_STATUS.held).toEqual(['confirm', 'expire', 'cancel']);
  });

  it('lets a confirmed booking be cancelled, moved, carried out, missed and staffed', () => {
    expect([...ACTIONS_BY_STATUS.confirmed].sort()).toEqual(
      ['assign', 'cancel', 'complete', 'mark-no-show', 'reschedule', 'unassign'].sort(),
    );
  });

  it('has no way out of a terminal status', () => {
    for (const status of ['cancelled', 'completed', 'no_show', 'expired'] as const) {
      expect(isTerminal(status)).toBe(true);
      for (const action of BOOKING_ACTIONS) {
        expect(isActionAllowed(status, action)).toBe(false);
      }
    }
    expect(isTerminal('held')).toBe(false);
    expect(isTerminal('confirmed')).toBe(false);
  });

  it('derives the allowed transitions from the actions, and forbids the others', () => {
    const allowed = BOOKING_STATUSES.flatMap((from) =>
      BOOKING_STATUSES.filter((to) => canTransition(from, to)).map((to) => `${from}>${to}`),
    );
    expect(allowed.sort()).toEqual(
      [
        'held>confirmed',
        'held>expired',
        'held>cancelled',
        'confirmed>cancelled',
        'confirmed>completed',
        'confirmed>no_show',
      ].sort(),
    );
    // Not allowed: skipping the confirmation, coming back, and moving between ends.
    expect(canTransition('held', 'completed')).toBe(false);
    expect(canTransition('cancelled', 'confirmed')).toBe(false);
    expect(canTransition('completed', 'no_show')).toBe(false);
    expect(canTransition('confirmed', 'held')).toBe(false);
    expect(canTransition('confirmed', 'expired')).toBe(false);
  });
});

describe('which bookings occupy availability', () => {
  const held = makeBooking({
    status: 'held',
    customer: null,
    holdExpiresAt: addMinutes(NOW, minutes(5)),
  });

  it('blocks while confirmed, and while a hold is still running', () => {
    expect(isBlocking(makeBooking(), NOW)).toBe(true);
    expect(isBlocking(held, NOW)).toBe(true);
  });

  it('stops blocking at the very instant a hold expires, before anything marks it', () => {
    expect(isBlocking(held, addMinutes(NOW, minutes(4)))).toBe(true);
    expect(isBlocking(held, addMinutes(NOW, minutes(5)))).toBe(false);
    expect(isHoldExpired(held, addMinutes(NOW, minutes(5)))).toBe(true);
  });

  it('never blocks once it is over', () => {
    for (const status of ['cancelled', 'completed', 'no_show', 'expired'] as const) {
      expect(isBlocking(makeBooking({ status }), NOW)).toBe(false);
    }
  });
});

describe('cancelling', () => {
  const service = makeService();
  const booking = makeBooking();
  const TWENTY_FOUR_HOURS = minutes(24 * 60);

  it('records who cancelled and when, and stops occupying the resources', () => {
    const cancelled = unwrap(cancelBooking({ booking, service, actor: 'manager', now: NOW }));

    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancelledBy).toBe('manager');
    expect(cancelled.cancelledAt).toBe(NOW);
    expect(isBlocking(cancelled, NOW)).toBe(false);
    expect(findInvariantViolations(cancelled)).toEqual([]);
  });

  it('lets a customer cancel up to the deadline and not a minute later', () => {
    const deadline = at(MONDAY, '10:00');
    const onTime = addMinutes(at('2027-01-10', '10:00'), minutes(0));
    expect(deadline - onTime).toBe(TWENTY_FOUR_HOURS * 60_000);

    expect(cancelBooking({ booking, service, actor: 'customer', now: onTime }).isOk()).toBe(true);
    const late = addMinutes(onTime, minutes(1));
    expect(codeOf(cancelBooking({ booking, service, actor: 'customer', now: late }))).toBe(
      CODES.cancellationDeadlinePassed,
    );
  });

  it('does not bind employees and managers to the deadline', () => {
    const lastMinute = at(MONDAY, '09:59');
    expect(cancelBooking({ booking, service, actor: 'employee', now: lastMinute }).isOk()).toBe(
      true,
    );
    expect(cancelBooking({ booking, service, actor: 'manager', now: lastMinute }).isOk()).toBe(
      true,
    );
  });

  it('refuses an actor the service does not name, and a service that forbids cancelling', () => {
    const noCustomers = makeService({
      cancellation: allowedPolicy(60, { allowedActors: ['manager'] }),
    });
    expect(
      codeOf(cancelBooking({ booking, service: noCustomers, actor: 'customer', now: NOW })),
    ).toBe(CODES.cancellationNotAllowed);
    const forbidden = makeService({ cancellation: allowedPolicy(60, { isAllowed: false }) });
    expect(codeOf(cancelBooking({ booking, service: forbidden, actor: 'manager', now: NOW }))).toBe(
      CODES.cancellationNotAllowed,
    );
  });

  it('lets anybody abandon a hold, whatever the policy says', () => {
    const hold = makeBooking({
      status: 'held',
      customer: null,
      holdExpiresAt: addMinutes(NOW, minutes(5)),
    });
    const forbidden = makeService({ cancellation: allowedPolicy(60, { isAllowed: false }) });
    const cancelled = unwrap(
      cancelBooking({ booking: hold, service: forbidden, actor: 'customer', now: NOW }),
    );
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.holdExpiresAt).toBeNull();
    expect(findInvariantViolations(cancelled)).toEqual([]);
  });

  it('is refused for a booking that is over', () => {
    for (const status of ['cancelled', 'completed', 'no_show', 'expired'] as const) {
      expect(
        codeOf(
          cancelBooking({ booking: makeBooking({ status }), service, actor: 'manager', now: NOW }),
        ),
      ).toBe(CODES.invalidStateTransition);
    }
  });
});

describe('carrying out the appointment', () => {
  const booking = makeBooking();

  it('completes only once the appointment has begun, at the very instant of the start', () => {
    expect(codeOf(completeBooking(booking, at(MONDAY, '09:59')))).toBe(CODES.bookingNotStarted);
    const done = unwrap(completeBooking(booking, at(MONDAY, '10:00')));
    expect(done.status).toBe('completed');
    expect(findInvariantViolations(done)).toEqual([]);
  });

  it('cannot complete a booking nobody served, but can record that the customer did not come', () => {
    const open = makeBooking({ assignments: [unitOf(null)] });
    expect(codeOf(completeBooking(open, at(MONDAY, '10:30')))).toBe(CODES.assignmentIncomplete);
    expect(unwrap(markNoShow(open, at(MONDAY, '10:30'))).status).toBe('no_show');
  });

  it('records a no-show only after the start', () => {
    expect(codeOf(markNoShow(booking, at(MONDAY, '09:59')))).toBe(CODES.bookingNotStarted);
    expect(unwrap(markNoShow(booking, at(MONDAY, '10:00'))).status).toBe('no_show');
  });

  it('is refused from every other status', () => {
    for (const status of ['held', 'cancelled', 'completed', 'no_show', 'expired'] as const) {
      const other = makeBooking({ status });
      expect(codeOf(completeBooking(other, at(MONDAY, '11:00')))).toBe(
        CODES.invalidStateTransition,
      );
      expect(codeOf(markNoShow(other, at(MONDAY, '11:00')))).toBe(CODES.invalidStateTransition);
    }
  });
});

describe('rescheduling', () => {
  const service = makeService();
  const booking = makeBooking();
  const newSlot = slotAt(service, '11:00');

  it('moves the booking, counts the move, and keeps status, service and location', () => {
    const moved = unwrap(
      rescheduleBooking({ booking, service, slot: newSlot, actor: 'customer', now: NOW }),
    );

    expect(moved.status).toBe('confirmed');
    expect(moved.start).toBe(newSlot.start);
    expect(moved.occupied).toEqual(newSlot.occupied);
    expect(moved.rescheduleCount).toBe(1);
    expect(moved.serviceId).toBe(booking.serviceId);
    expect(moved.locationId).toBe(booking.locationId);
    expect(moved.id).toBe(booking.id);
    expect(findInvariantViolations(moved)).toEqual([]);
  });

  it.each(['employee', 'manager'] as const)(
    'does not count a move by %s against the customer’s limit',
    (actor) => {
      const moved = unwrap(rescheduleBooking({ booking, service, slot: newSlot, actor, now: NOW }));

      expect(moved.rescheduleCount).toBe(booking.rescheduleCount);
    },
  );

  it('takes the employee the engine chose for the new time, for an automatic service', () => {
    const moved = unwrap(
      rescheduleBooking({
        booking,
        service,
        slot: slotAt(service, '11:00', [['ben']]),
        actor: 'manager',
        now: NOW,
      }),
    );
    // The unit is held for the new time.
    expect(moved.assignments).toEqual([unitOf('ben', { occupied: moved.occupied })]);
  });

  it('opens the employee units again for a service that is assigned later', () => {
    const open = makeService({ assignmentMode: 'open' });
    const moved = unwrap(
      rescheduleBooking({
        booking,
        service: open,
        slot: slotAt(open, '11:00'),
        actor: 'manager',
        now: NOW,
      }),
    );
    expect(moved.assignments).toEqual([unitOf(null, { occupied: moved.occupied })]);
  });

  it('cannot bypass the policy: deadline, limit and actor are checked here', () => {
    const tooLate = at(MONDAY, '00:00');
    expect(
      codeOf(
        rescheduleBooking({ booking, service, slot: newSlot, actor: 'customer', now: tooLate }),
      ),
    ).toBe(CODES.reschedulingDeadlinePassed);
    expect(
      rescheduleBooking({
        booking,
        service,
        slot: newSlot,
        actor: 'employee',
        now: tooLate,
      }).isOk(),
    ).toBe(true);

    const worn = makeBooking({ rescheduleCount: 3 });
    expect(
      codeOf(
        rescheduleBooking({ booking: worn, service, slot: newSlot, actor: 'customer', now: NOW }),
      ),
    ).toBe(CODES.reschedulingLimitReached);
    expect(
      rescheduleBooking({
        booking: worn,
        service,
        slot: newSlot,
        actor: 'manager',
        now: NOW,
      }).isOk(),
    ).toBe(true);
    const noCustomers = makeService({
      rescheduling: allowedPolicy(60, { allowedActors: ['manager'] }),
    });
    expect(
      codeOf(
        rescheduleBooking({
          booking,
          service: noCustomers,
          slot: newSlot,
          actor: 'customer',
          now: NOW,
        }),
      ),
    ).toBe(CODES.reschedulingNotAllowed);
  });

  it('refuses a slot that does not fit the service, and any status but confirmed', () => {
    expect(
      codeOf(
        rescheduleBooking({
          booking,
          service,
          slot: { ...newSlot, end: addMinutes(newSlot.end, minutes(15)) },
          actor: 'manager',
          now: NOW,
        }),
      ),
    ).toBe(CODES.slotUnavailable);
    for (const status of ['held', 'cancelled', 'completed', 'no_show', 'expired'] as const) {
      expect(
        codeOf(
          rescheduleBooking({
            booking: makeBooking({ status }),
            service,
            slot: newSlot,
            actor: 'manager',
            now: NOW,
          }),
        ),
      ).toBe(CODES.invalidStateTransition);
    }
  });
});
