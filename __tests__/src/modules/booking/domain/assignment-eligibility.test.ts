import { describe, expect, it } from 'vitest';

import {
  assessCandidates,
  assessEligibility,
} from '@modules/booking/domain/assignment/assignment-eligibility';
import type { AssignmentCandidate } from '@modules/booking/domain/assignment/assignment-eligibility';
import type { BookableResource } from '@modules/booking/domain/models/bookable-resource';
import type { ServiceRequirement } from '@modules/booking/domain/models/bookable-service';
import type { Booking } from '@modules/booking/domain/models/booking';
import { toBookableResourceId } from '@modules/booking/domain/models/ids';

import {
  NOW,
  MONDAY,
  OTHER_LOCATION,
  WORKDAY,
  employee,
  makeBooking,
  makeService,
  schedule,
  unitOf,
} from '../support/booking-fixtures';
import { at, between } from '../support/time-fixtures';

const REQUIREMENT: ServiceRequirement = {
  resourceType: 'employee',
  skills: ['ausweise'],
  count: 1,
  resourceIds: null,
};

/** An open booking: the employee unit waits for somebody. Ben's calendar is the one asked about. */
const OPEN = makeBooking({ assignments: [unitOf(null)] });

function candidate(
  id: string,
  options: {
    resource?: Partial<BookableResource>;
    availability?: AssignmentCandidate['schedule']['availability'];
    busy?: AssignmentCandidate['schedule']['busy'];
  } = {},
): AssignmentCandidate {
  return {
    resource: employee(id, options.resource),
    schedule: schedule(id, options.availability ?? [WORKDAY], options.busy ?? []),
  };
}

function reasonsOf(
  asked: AssignmentCandidate,
  options: { booking?: Booking; requirement?: ServiceRequirement; requirementIndex?: number } = {},
) {
  const assessment = assessEligibility({
    now: NOW,
    booking: options.booking ?? OPEN,
    requirement: options.requirement ?? REQUIREMENT,
    requirementIndex: options.requirementIndex ?? 0,
    candidate: asked,
  });
  return assessment.kind === 'ineligible' ? assessment.reasons.map((reason) => reason.code) : [];
}

describe('who is eligible', () => {
  it('accepts an active, qualified employee at the location whose calendar is free', () => {
    const assessment = assessEligibility({
      now: NOW,
      booking: OPEN,
      requirement: REQUIREMENT,
      requirementIndex: 0,
      candidate: candidate('ben'),
    });

    expect(assessment.kind).toBe('eligible');
    if (assessment.kind === 'eligible') {
      expect(assessment.candidate.resource.id).toBe('ben');
      expect(assessment.candidate.bookingId).toBe(OPEN.id);
      expect(assessment.candidate.requirementIndex).toBe(0);
    }
  });

  it('does not accept an employee only because the calendar looks free', () => {
    // Free all day, but not qualified, wrong place, inactive: each alone is enough.
    expect(reasonsOf(candidate('ben', { resource: { skills: [] } }))).toEqual([
      'missing-qualification',
    ]);
    expect(reasonsOf(candidate('ben', { resource: { locationId: OTHER_LOCATION } }))).toEqual([
      'wrong-location',
    ]);
    expect(reasonsOf(candidate('ben', { resource: { isActive: false } }))).toEqual([
      'resource-inactive',
    ]);
    expect(reasonsOf(candidate('ben', { resource: { type: 'room' } }))).toEqual([
      'wrong-resource-type',
    ]);
  });

  it('names the missing skills, and needs every skill of the requirement', () => {
    const demanding: ServiceRequirement = { ...REQUIREMENT, skills: ['ausweise', 'visa', 'pass'] };
    const assessment = assessEligibility({
      now: NOW,
      booking: OPEN,
      requirement: demanding,
      requirementIndex: 0,
      candidate: candidate('ben', { resource: { skills: ['ausweise', 'pass'] } }),
    });

    expect(assessment).toMatchObject({
      kind: 'ineligible',
      reasons: [{ code: 'missing-qualification', missing: ['visa'] }],
    });
  });

  it('lets a resource without a location serve every location, and an employee only their own', () => {
    expect(
      reasonsOf(candidate('van', { resource: { type: 'employee', locationId: null } })),
    ).toEqual([]);
    expect(reasonsOf(candidate('ben', { resource: { locationId: OTHER_LOCATION } }))).toEqual([
      'wrong-location',
    ]);
  });

  it('respects a pinned pool', () => {
    const pinned: ServiceRequirement = {
      ...REQUIREMENT,
      resourceIds: [toBookableResourceId('anna')],
    };
    expect(reasonsOf(candidate('ben'), { requirement: pinned })).toEqual(['not-in-pinned-pool']);
    expect(reasonsOf(candidate('anna'), { requirement: pinned })).toEqual([]);
  });

  it('needs the employee to work through the whole occupied span', () => {
    const shortDay = between(MONDAY, '10:15', '17:00');
    expect(reasonsOf(candidate('ben', { availability: [shortDay] }))).toEqual([
      'outside-working-hours',
    ]);
    expect(reasonsOf(candidate('ben', { availability: [] }))).toEqual(['outside-working-hours']);
    // Working exactly through the span is enough.
    expect(
      reasonsOf(candidate('ben', { availability: [between(MONDAY, '10:00', '10:30')] })),
    ).toEqual([]);
  });

  it('reports the booking that overlaps, and not one that merely touches', () => {
    const other = between(MONDAY, '09:15', '10:15');
    const assessment = assessEligibility({
      now: NOW,
      booking: OPEN,
      requirement: REQUIREMENT,
      requirementIndex: 0,
      candidate: candidate('ben', { busy: [other] }),
    });
    expect(assessment).toMatchObject({
      kind: 'ineligible',
      reasons: [{ code: 'time-conflict', with: other }],
    });

    expect(reasonsOf(candidate('ben', { busy: [between(MONDAY, '09:30', '10:00')] }))).toEqual([]);
    expect(reasonsOf(candidate('ben', { busy: [between(MONDAY, '10:30', '11:00')] }))).toEqual([]);
  });

  it('reports every reason that applies, in a fixed order', () => {
    const wrong = candidate('ben', {
      resource: { isActive: false, skills: [], locationId: OTHER_LOCATION },
      availability: [],
      busy: [between(MONDAY, '10:00', '10:30')],
    });
    expect(reasonsOf(wrong)).toEqual([
      'resource-inactive',
      'missing-qualification',
      'wrong-location',
      'outside-working-hours',
      'time-conflict',
    ]);
  });

  it('assigns only a booking that stands', () => {
    for (const status of ['held', 'cancelled', 'completed', 'no_show', 'expired'] as const) {
      expect(
        reasonsOf(candidate('ben'), {
          booking: makeBooking({ status, assignments: [unitOf(null)] }),
        }),
      ).toEqual(['booking-not-assignable']);
    }
  });

  it('does not let one resource serve two requirements, but accepts one that already holds this unit', () => {
    const twoRequirements = makeBooking({
      assignments: [unitOf('ben'), unitOf(null, { requirementIndex: 1 })],
    });
    expect(reasonsOf(candidate('ben'), { booking: twoRequirements, requirementIndex: 1 })).toEqual([
      'already-on-booking',
    ]);
    // Asking again about the unit he already holds is not a problem: the claim is repeatable.
    expect(reasonsOf(candidate('ben'), { booking: twoRequirements, requirementIndex: 0 })).toEqual(
      [],
    );
  });
});

describe('sorting candidates', () => {
  it('splits eligible from not, each by id, whatever the order they came in', () => {
    const candidates = [
      candidate('carl', { resource: { skills: [] } }),
      candidate('ben'),
      candidate('anna', { busy: [between(MONDAY, '10:00', '10:30')] }),
      candidate('dora'),
    ];
    const split = (list: AssignmentCandidate[]) =>
      assessCandidates({
        now: NOW,
        booking: OPEN,
        requirement: REQUIREMENT,
        requirementIndex: 0,
        candidates: list,
      });

    const forward = split(candidates);
    const backward = split([...candidates].reverse());

    expect(forward.eligible.map((entry) => entry.resource.id)).toEqual(['ben', 'dora']);
    expect(forward.ineligible.map((entry) => entry.resourceId)).toEqual(['anna', 'carl']);
    expect(forward).toEqual(backward);
  });

  it('uses the same rule the service form talks about', () => {
    expect(makeService().requirements).toEqual([REQUIREMENT]);
  });
});

describe('a booking that is over', () => {
  // Regression: a confirmed booking whose appointment had ended could still be claimed.
  const ended = at(MONDAY, '10:30');

  it('cannot be taken from the instant it ends, and still can a minute before', () => {
    const assess = (now: typeof ended) =>
      assessEligibility({
        now,
        booking: OPEN,
        requirement: REQUIREMENT,
        requirementIndex: 0,
        candidate: candidate('ben'),
      });

    expect(assess(at(MONDAY, '10:29')).kind).toBe('eligible');
    const late = assess(ended);
    expect(late.kind === 'ineligible' && late.reasons.map((reason) => reason.code)).toEqual([
      'booking-over',
    ]);
  });
});
