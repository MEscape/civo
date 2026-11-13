import { describe, expect, it } from 'vitest';

import { assessEligibility } from '@modules/booking/domain/assignment/assignment-eligibility';
import type { EligibleCandidate } from '@modules/booking/domain/assignment/assignment-eligibility';
import {
  assignmentChangesOf,
  releaseAssignment,
  replaceAssignment,
} from '@modules/booking/domain/assignment/booking-assignment';
import { BOOKING_ERROR_CODES as CODES } from '@modules/booking/domain/errors/booking-errors';
import { findInvariantViolations } from '@modules/booking/domain/lifecycle/booking-invariants';
import type { Booking } from '@modules/booking/domain/models/booking';
import { toBookableResourceId, toBookingId } from '@modules/booking/domain/models/ids';

import {
  MONDAY,
  NOW,
  WORKDAY,
  employee,
  makeBooking,
  makeService,
  schedule,
  unitOf,
} from '../support/booking-fixtures';
import { at, unwrap } from '../support/time-fixtures';

// The default booking begins on Monday at 10:00, with Anna on it.
const BEFORE_START = at(MONDAY, '09:59');
const AT_START = at(MONDAY, '10:00');
const AUTOMATIC = makeService({ assignmentMode: 'automatic' });
const OPEN = makeService({ assignmentMode: 'open' });
const ANNA = toBookableResourceId('anna');

function eligible(booking: Booking, id: string): EligibleCandidate {
  const assessment = assessEligibility({
    now: NOW,
    booking,
    requirement: OPEN.requirements[0]!,
    requirementIndex: 0,
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

describe('handing back, by the employee or a manager, ends when the booking begins', () => {
  const booking = makeBooking();
  const release = (now: typeof NOW) =>
    releaseAssignment({ booking, service: OPEN, resourceId: ANNA, now });

  it('is allowed a minute before the start', () => {
    expect(unwrap(release(BEFORE_START)).assignments).toEqual([unitOf(null)]);
  });

  it('is refused at the start and after it, so a past booking never opens again', () => {
    expect(codeOf(release(AT_START))).toBe(CODES.bookingStarted);
    expect(codeOf(release(at('2027-01-12', '10:00')))).toBe(CODES.bookingStarted);
  });
});

describe('replacing an employee', () => {
  const booking = makeBooking();
  const replace = (overrides: Partial<Parameters<typeof replaceAssignment>[0]> = {}) =>
    replaceAssignment({
      booking,
      replaced: ANNA,
      candidate: eligible(booking, 'ben'),
      now: BEFORE_START,
      ...overrides,
    });

  it('swaps the unit in one step, the place never open, a minute before the start', () => {
    const replaced = unwrap(replace());

    expect(replaced.assignments).toEqual([unitOf('ben')]);
    expect(replaced.updatedAt).toBe(BEFORE_START);
    expect(findInvariantViolations(replaced)).toEqual([]);
  });

  it('is refused once the booking has begun', () => {
    expect(codeOf(replace({ now: AT_START }))).toBe(CODES.bookingStarted);
  });

  it('changes nothing when sent again after the swap', () => {
    const replaced = unwrap(replace());
    const again = replaceAssignment({
      booking: replaced,
      replaced: ANNA,
      candidate: eligible(replaced, 'ben'),
      now: BEFORE_START,
    });

    expect(unwrap(again)).toBe(replaced);
  });

  it('refuses a resource that is not on the booking, and a candidate already on it', () => {
    expect(codeOf(replace({ replaced: toBookableResourceId('carl') }))).toBe(CODES.notAssigned);
    const two = makeBooking({ assignments: [unitOf('anna'), unitOf('ben')] });
    expect(codeOf(replace({ booking: two, candidate: eligible(two, 'ben') }))).toBe(
      CODES.notEligible,
    );
  });

  it('refuses a candidate checked for another booking, and a booking that is not confirmed', () => {
    const other = makeBooking({ id: toBookingId('booking-2') });
    expect(codeOf(replace({ candidate: eligible(other, 'ben') }))).toBe(CODES.notEligible);
    expect(codeOf(replace({ booking: { ...booking, status: 'completed' } }))).toBe(
      CODES.invalidStateTransition,
    );
  });
});

describe('what the panel offers is what the operations accept', () => {
  it('agrees for every mode, before and at the start, confirmed or not', () => {
    for (const service of [OPEN, AUTOMATIC]) {
      for (const now of [BEFORE_START, AT_START]) {
        for (const booking of [makeBooking(), makeBooking({ status: 'completed' })]) {
          const changes = assignmentChangesOf(booking, service, now);
          const replaced = replaceAssignment({
            booking,
            replaced: ANNA,
            candidate: eligible(makeBooking(), 'ben'),
            now,
          });
          expect(changes.mayReplace).toBe(replaced.isOk());
          expect(changes.mayRemove).toBe(
            releaseAssignment({ booking, service, resourceId: ANNA, now }).isOk(),
          );
        }
      }
    }
  });
});
