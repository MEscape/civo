import { describe, expect, it } from 'vitest';

import { assessEligibility } from '@modules/booking/domain/assignment/assignment-eligibility';
import type { EligibleCandidate } from '@modules/booking/domain/assignment/assignment-eligibility';
import {
  assignResource,
  assignmentStateOf,
  releaseAssignment,
} from '@modules/booking/domain/assignment/booking-assignment';
import { BOOKING_ERROR_CODES as CODES } from '@modules/booking/domain/errors/booking-errors';
import { findInvariantViolations } from '@modules/booking/domain/lifecycle/booking-invariants';
import type { ServiceRequirement } from '@modules/booking/domain/models/bookable-service';
import type { Booking } from '@modules/booking/domain/models/booking';
import { toBookableResourceId, toBookingId } from '@modules/booking/domain/models/ids';

import {
  NOW,
  WORKDAY,
  employee,
  makeBooking,
  makeService,
  schedule,
  unitOf,
} from '../support/booking-fixtures';
import { unwrap } from '../support/time-fixtures';

const SERVICE = makeService({ assignmentMode: 'open' });
const REQUIREMENT: ServiceRequirement = {
  resourceType: 'employee',
  skills: ['ausweise'],
  count: 1,
  resourceIds: null,
};

function eligible(booking: Booking, id: string, requirementIndex = 0): EligibleCandidate {
  const assessment = assessEligibility({
    now: NOW,
    booking,
    requirement: REQUIREMENT,
    requirementIndex,
    candidate: { resource: employee(id), schedule: schedule(id, [WORKDAY]) },
  });
  if (assessment.kind !== 'eligible') {
    throw new Error(`fixture: ${id} is not eligible`);
  }
  return assessment.candidate;
}

function codeOf(result: { isErr(): boolean; error?: { code: string } }): string | undefined {
  return result.isErr() ? result.error?.code : undefined;
}

describe('claiming an open booking', () => {
  const open = makeBooking({ assignments: [unitOf(null)] });

  it('gives the open unit to the candidate', () => {
    const taken = unwrap(
      assignResource({ booking: open, candidate: eligible(open, 'ben'), now: NOW }),
    );

    expect(taken.assignments).toEqual([unitOf('ben')]);
    expect(taken.updatedAt).toBe(NOW);
    expect(taken.status).toBe('confirmed');
    expect(findInvariantViolations(taken)).toEqual([]);
    expect(open.assignments).toEqual([unitOf(null)]);
  });

  it('is repeatable by the same employee: the second claim succeeds and changes nothing', () => {
    const first = unwrap(
      assignResource({ booking: open, candidate: eligible(open, 'ben'), now: NOW }),
    );
    const second = unwrap(
      assignResource({ booking: first, candidate: eligible(first, 'ben'), now: NOW }),
    );

    expect(second).toBe(first);
  });

  it('says the booking is taken when somebody else claimed it first', () => {
    const first = unwrap(
      assignResource({ booking: open, candidate: eligible(open, 'ben'), now: NOW }),
    );
    const late = eligible(first, 'carl');

    expect(codeOf(assignResource({ booking: first, candidate: late, now: NOW }))).toBe(
      CODES.alreadyAssigned,
    );
  });

  it('fills the open units of a requirement one by one', () => {
    const twoNeeded = makeBooking({ assignments: [unitOf(null), unitOf(null)] });
    const one = unwrap(
      assignResource({ booking: twoNeeded, candidate: eligible(twoNeeded, 'ben'), now: NOW }),
    );
    const two = unwrap(
      assignResource({ booking: one, candidate: eligible(one, 'carl'), now: NOW }),
    );

    expect(two.assignments).toEqual([unitOf('ben'), unitOf('carl')]);
    expect(
      codeOf(assignResource({ booking: two, candidate: eligible(two, 'dora'), now: NOW })),
    ).toBe(CODES.alreadyAssigned);
  });

  it('refuses a candidate that was checked for another booking', () => {
    const other = makeBooking({ id: toBookingId('booking-2'), assignments: [unitOf(null)] });
    expect(
      codeOf(assignResource({ booking: open, candidate: eligible(other, 'ben'), now: NOW })),
    ).toBe(CODES.notEligible);
  });

  it('refuses a booking that is not confirmed', () => {
    for (const status of ['held', 'cancelled', 'completed', 'no_show', 'expired'] as const) {
      const booking = { ...open, status };
      expect(codeOf(assignResource({ booking, candidate: eligible(open, 'ben'), now: NOW }))).toBe(
        CODES.invalidStateTransition,
      );
    }
  });
});

describe('handing an assignment back', () => {
  const assigned = makeBooking({ assignments: [unitOf('ben')] });

  it('opens the unit again and keeps the booking', () => {
    const released = unwrap(
      releaseAssignment({
        booking: assigned,
        service: SERVICE,
        resourceId: toBookableResourceId('ben'),
        now: NOW,
      }),
    );

    expect(released.assignments).toEqual([unitOf(null)]);
    expect(released.status).toBe('confirmed');
    expect(findInvariantViolations(released)).toEqual([]);
  });

  it('makes the booking claimable again by a colleague', () => {
    const released = unwrap(
      releaseAssignment({
        booking: assigned,
        service: SERVICE,
        resourceId: toBookableResourceId('ben'),
        now: NOW,
      }),
    );
    expect(
      assignResource({ booking: released, candidate: eligible(released, 'carl'), now: NOW }).isOk(),
    ).toBe(true);
  });

  it('is refused for a resource that is not on the booking', () => {
    expect(
      codeOf(
        releaseAssignment({
          booking: assigned,
          service: SERVICE,
          resourceId: toBookableResourceId('carl'),
          now: NOW,
        }),
      ),
    ).toBe(CODES.notAssigned);
  });

  it('is refused for a service whose employees are assigned when it is booked', () => {
    expect(
      codeOf(
        releaseAssignment({
          booking: assigned,
          service: makeService({ assignmentMode: 'automatic' }),
          resourceId: toBookableResourceId('ben'),
          now: NOW,
        }),
      ),
    ).toBe(CODES.unassignNotAllowed);
  });

  it('is refused for a room: only an employee can be handed back', () => {
    const withRoom = makeBooking({
      assignments: [unitOf('ben'), unitOf('room-1', { requirementIndex: 1, resourceType: 'room' })],
    });
    expect(
      codeOf(
        releaseAssignment({
          booking: withRoom,
          service: SERVICE,
          resourceId: toBookableResourceId('room-1'),
          now: NOW,
        }),
      ),
    ).toBe(CODES.unassignNotAllowed);
  });

  it('is refused for a booking that is not confirmed', () => {
    expect(
      codeOf(
        releaseAssignment({
          booking: makeBooking({ status: 'completed', assignments: [unitOf('ben')] }),
          service: SERVICE,
          resourceId: toBookableResourceId('ben'),
          now: NOW,
        }),
      ),
    ).toBe(CODES.invalidStateTransition);
  });
});

describe('the assignment state', () => {
  it('is open while a unit waits, assigned when all are filled, and conflict when told so', () => {
    expect(assignmentStateOf(makeBooking({ assignments: [unitOf(null)] }), false)).toBe('open');
    expect(assignmentStateOf(makeBooking({ assignments: [unitOf('ben')] }), false)).toBe(
      'assigned',
    );
    expect(assignmentStateOf(makeBooking({ assignments: [unitOf('ben')] }), true)).toBe('conflict');
    expect(assignmentStateOf(makeBooking({ assignments: [unitOf(null)] }), true)).toBe('conflict');
  });

  it('is not a status: the lifecycle statuses are unchanged by it', () => {
    const open = makeBooking({ assignments: [unitOf(null)] });
    expect(open.status).toBe('confirmed');
    expect(assignmentStateOf(open, false)).toBe('open');
  });
});
