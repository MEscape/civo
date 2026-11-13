import { describe, expect, it } from 'vitest';

import { analyzeChange } from '@modules/booking/domain/impact/analyze-change';
import type { ProposedChange } from '@modules/booking/domain/impact/impact-types';
import { toBookableResourceId } from '@modules/booking/domain/models/ids';

import {
  LOCATION,
  MONDAY,
  NOW,
  OTHER_LOCATION,
  WORKDAY,
  allowedPolicy,
  employee,
  makeBooking,
  makeService,
  schedule,
  schedulingFor,
  unitOf,
} from '../support/booking-fixtures';
import { at, between } from '../support/time-fixtures';

const SERVICE = makeService();
const ANNA = toBookableResourceId('anna');

function analyze(change: ProposedChange, service = SERVICE) {
  return analyzeChange({ service, now: NOW }, change);
}

function codes(analysis: { violations: ReadonlyArray<{ code: string }> }): string[] {
  return analysis.violations.map((violation) => violation.code);
}

describe('creating a booking', () => {
  const scheduling = schedulingFor(SERVICE, [schedule('anna', [WORKDAY])]);

  it('finds nothing against a slot that can be booked', () => {
    const analysis = analyze({
      kind: 'create',
      channel: 'staff',
      locationId: LOCATION,
      start: at(MONDAY, '10:00'),
      scheduling,
    });
    expect(analysis).toEqual({ isBlocked: false, violations: [], warnings: [], unchecked: [] });
  });

  it('is blocked by a service that is off or not offered there', () => {
    const start = at(MONDAY, '10:00');
    expect(
      codes(
        analyze(
          { kind: 'create', channel: 'staff', locationId: LOCATION, start, scheduling },
          makeService({ isActive: false }),
        ),
      ),
    ).toEqual(['service-inactive']);
    expect(
      codes(
        analyze({
          kind: 'create',
          channel: 'staff',
          locationId: OTHER_LOCATION,
          start,
          scheduling,
        }),
      ),
    ).toEqual(['location-not-offered']);
  });

  it('says why the engine refuses the start', () => {
    const reasonOf = (time: string) =>
      analyze({
        kind: 'create',
        channel: 'staff',
        locationId: LOCATION,
        start: at(MONDAY, time),
        scheduling,
      }).violations[0];

    expect(reasonOf('10:10')).toEqual({ code: 'slot-rejected', reason: 'off-grid' });
    expect(reasonOf('18:00')).toEqual({ code: 'slot-rejected', reason: 'outside-open-hours' });
    const busy = schedulingFor(SERVICE, [
      schedule('anna', [WORKDAY], [between(MONDAY, '10:00', '10:30')]),
    ]);
    expect(
      analyze({
        kind: 'create',
        channel: 'staff',
        locationId: LOCATION,
        start: at(MONDAY, '10:00'),
        scheduling: busy,
      }).violations[0],
    ).toEqual({ code: 'slot-rejected', reason: 'resources-unavailable' });
  });

  it('does not claim to have checked the slot when no schedule was supplied', () => {
    const analysis = analyze({
      kind: 'create',
      channel: 'staff',
      locationId: LOCATION,
      start: at(MONDAY, '10:00'),
      scheduling: null,
    });
    expect(analysis.unchecked).toEqual(['slot']);
    expect(analysis.isBlocked).toBe(false);
  });
});

describe('cancelling', () => {
  const booking = makeBooking();

  it('warns that the visitor is told and the employee is released, when somebody else cancels', () => {
    const analysis = analyze({ kind: 'cancel', booking, actor: 'manager' });

    expect(analysis.isBlocked).toBe(false);
    expect(analysis.warnings).toEqual([
      { code: 'customer-notified' },
      { code: 'employees-released', resourceIds: [ANNA] },
    ]);
  });

  it('does not warn the customer about their own cancellation', () => {
    // Two days ahead: still inside the customer's 24-hour deadline.
    const early = { service: SERVICE, now: at('2027-01-09', '12:00') };
    const analysis = analyzeChange(early, { kind: 'cancel', booking, actor: 'customer' });
    expect(analysis.warnings).toEqual([{ code: 'employees-released', resourceIds: [ANNA] }]);
  });

  it('is blocked by the deadline for a customer only, and by a service that forbids it', () => {
    const late = analyzeChange(
      { service: SERVICE, now: at(MONDAY, '09:00') },
      { kind: 'cancel', booking, actor: 'customer' },
    );
    expect(late.violations).toEqual([
      { code: 'change-refused', change: 'cancellation', denial: 'deadline-passed' },
    ]);
    expect(
      analyzeChange(
        { service: SERVICE, now: at(MONDAY, '09:00') },
        { kind: 'cancel', booking, actor: 'manager' },
      ).isBlocked,
    ).toBe(false);

    const forbidden = makeService({ cancellation: allowedPolicy(60, { isAllowed: false }) });
    expect(analyze({ kind: 'cancel', booking, actor: 'manager' }, forbidden).violations).toEqual([
      { code: 'change-refused', change: 'cancellation', denial: 'disabled' },
    ]);
  });

  it('is blocked for a booking that is over, naming the status', () => {
    expect(
      analyze({ kind: 'cancel', booking: makeBooking({ status: 'completed' }), actor: 'manager' })
        .violations,
    ).toEqual([{ code: 'status-not-allowed', status: 'completed', action: 'cancel' }]);
  });
});

describe('rescheduling', () => {
  const booking = makeBooking();
  const scheduling = schedulingFor(SERVICE, [schedule('anna', [WORKDAY])]);

  it('finds nothing against a free slot, and no change of employee when anna stays', () => {
    const analysis = analyze({
      kind: 'reschedule',
      booking,
      actor: 'customer',
      start: at(MONDAY, '11:00'),
      scheduling,
    });
    expect(analysis).toEqual({ isBlocked: false, violations: [], warnings: [], unchecked: [] });
  });

  it('warns when a manager moves it, and when the employee is another one afterwards', () => {
    const benOnly = schedulingFor(SERVICE, [schedule('ben', [WORKDAY])]);
    const analysis = analyze({
      kind: 'reschedule',
      booking,
      actor: 'manager',
      start: at(MONDAY, '11:00'),
      scheduling: benOnly,
    });

    expect(analysis.warnings).toEqual([
      { code: 'customer-notified' },
      { code: 'employees-change', before: [ANNA], after: [toBookableResourceId('ben')] },
    ]);
  });

  it('is blocked by a slot that is taken, off the grid, or outside the opening hours', () => {
    const taken = schedulingFor(SERVICE, [
      schedule('anna', [WORKDAY], [between(MONDAY, '11:00', '11:30')]),
    ]);
    expect(
      analyze({
        kind: 'reschedule',
        booking,
        actor: 'manager',
        start: at(MONDAY, '11:00'),
        scheduling: taken,
      }).violations,
    ).toEqual([{ code: 'slot-rejected', reason: 'resources-unavailable' }]);
    expect(
      analyze({
        kind: 'reschedule',
        booking,
        actor: 'manager',
        start: at(MONDAY, '11:10'),
        scheduling,
      }).violations,
    ).toEqual([{ code: 'slot-rejected', reason: 'off-grid' }]);
    expect(
      analyze({
        kind: 'reschedule',
        booking,
        actor: 'manager',
        start: at(MONDAY, '20:00'),
        scheduling,
      }).violations,
    ).toEqual([{ code: 'slot-rejected', reason: 'outside-open-hours' }]);
  });

  it('reports the policy and the slot together, and says what is a limit for the customer only', () => {
    const worn = makeBooking({ rescheduleCount: 3 });
    const analysis = analyze({
      kind: 'reschedule',
      booking: worn,
      actor: 'customer',
      start: at(MONDAY, '10:10'),
      scheduling,
    });
    expect(codes(analysis)).toEqual(['change-refused', 'slot-rejected']);
    expect(
      analyze({
        kind: 'reschedule',
        booking: worn,
        actor: 'manager',
        start: at(MONDAY, '11:00'),
        scheduling,
      }).isBlocked,
    ).toBe(false);
  });

  it('does not claim to have checked the slot when no schedule was supplied', () => {
    const analysis = analyze({
      kind: 'reschedule',
      booking,
      actor: 'customer',
      start: at(MONDAY, '11:00'),
      scheduling: null,
    });
    expect(analysis.unchecked).toEqual(['slot']);
  });

  it('is blocked for a booking that is not confirmed', () => {
    expect(
      analyze({
        kind: 'reschedule',
        booking: makeBooking({ status: 'cancelled' }),
        actor: 'manager',
        start: at(MONDAY, '11:00'),
        scheduling,
      }).violations,
    ).toEqual([{ code: 'status-not-allowed', status: 'cancelled', action: 'reschedule' }]);
  });
});

describe('assigning and handing back', () => {
  const OPEN_SERVICE = makeService({ assignmentMode: 'open' });
  const open = makeBooking({ assignments: [unitOf(null)] });
  const ben = { resource: employee('ben'), schedule: schedule('ben', [WORKDAY]) };

  it('finds nothing against an eligible employee for an open unit', () => {
    expect(
      analyze({ kind: 'assign', booking: open, requirementIndex: 0, candidate: ben }, OPEN_SERVICE),
    ).toEqual({
      isBlocked: false,
      violations: [],
      warnings: [],
      unchecked: [],
    });
  });

  it('lists why an employee is not eligible', () => {
    const busy = {
      resource: employee('ben', { skills: [] }),
      schedule: schedule('ben', [WORKDAY], [between(MONDAY, '10:00', '10:30')]),
    };
    const [violation] = analyze(
      { kind: 'assign', booking: open, requirementIndex: 0, candidate: busy },
      OPEN_SERVICE,
    ).violations;

    expect(violation).toMatchObject({ code: 'not-eligible' });
    expect(
      violation?.code === 'not-eligible' && violation.reasons.map((reason) => reason.code),
    ).toEqual(['missing-qualification', 'time-conflict']);
  });

  it('does not claim to have checked eligibility when no candidate was supplied', () => {
    const analysis = analyze(
      { kind: 'assign', booking: open, requirementIndex: 0, candidate: null },
      OPEN_SERVICE,
    );
    expect(analysis.unchecked).toEqual(['eligibility']);
    expect(analysis.isBlocked).toBe(false);
    expect(
      analyze(
        {
          kind: 'assign',
          booking: makeBooking({ assignments: [unitOf('anna')] }),
          requirementIndex: 0,
          candidate: null,
        },
        OPEN_SERVICE,
      ).violations,
    ).toEqual([{ code: 'no-open-unit' }]);
  });

  it('is blocked when no unit is open, unless the employee already holds one', () => {
    const taken = makeBooking({ assignments: [unitOf('anna')] });
    expect(
      analyze({ kind: 'assign', booking: taken, requirementIndex: 0, candidate: ben }, OPEN_SERVICE)
        .violations,
    ).toEqual([{ code: 'no-open-unit' }]);
    const anna = { resource: employee('anna'), schedule: schedule('anna', [WORKDAY]) };
    expect(
      analyze(
        { kind: 'assign', booking: taken, requirementIndex: 0, candidate: anna },
        OPEN_SERVICE,
      ).isBlocked,
    ).toBe(false);
  });

  it('is blocked for an unknown requirement and for a booking that is not confirmed', () => {
    expect(
      analyze({ kind: 'assign', booking: open, requirementIndex: 4, candidate: ben }, OPEN_SERVICE)
        .violations,
    ).toEqual([{ code: 'requirement-unknown' }]);
    expect(
      analyze(
        {
          kind: 'assign',
          booking: makeBooking({ status: 'held', assignments: [unitOf(null)] }),
          requirementIndex: 0,
          candidate: ben,
        },
        OPEN_SERVICE,
      ).violations,
    ).toEqual([{ code: 'status-not-allowed', status: 'held', action: 'assign' }]);
  });

  it('judges handing back by the service and by who is on the booking', () => {
    const assigned = makeBooking({ assignments: [unitOf('ben')] });
    const give = (resourceId: string, service = OPEN_SERVICE) =>
      analyze(
        { kind: 'unassign', booking: assigned, resourceId: toBookableResourceId(resourceId) },
        service,
      );

    expect(give('ben').isBlocked).toBe(false);
    expect(give('carl').violations).toEqual([{ code: 'not-assigned' }]);
    expect(give('ben', makeService({ assignmentMode: 'automatic' })).violations).toEqual([
      { code: 'unassign-not-allowed' },
    ]);
  });
});

describe('a schedule built for another service', () => {
  // Regression: the analysis used to find nothing wrong with a slot the operations then refused,
  // because the schedule had been built for a service with other durations.
  const other = makeService({ slot: { durationMinutes: 60, stepMinutes: 30 } });
  const wrongScheduling = schedulingFor(other, [schedule('anna', [WORKDAY])]);

  it('blocks creating a booking from it', () => {
    const analysis = analyze({
      kind: 'create',
      channel: 'staff',
      locationId: LOCATION,
      start: at(MONDAY, '10:00'),
      scheduling: wrongScheduling,
    });

    expect(analysis.violations).toEqual([{ code: 'slot-does-not-fit-service' }]);
    expect(analysis.isBlocked).toBe(true);
  });

  it('blocks moving a booking onto it, with no warnings about a move that cannot happen', () => {
    const analysis = analyze({
      kind: 'reschedule',
      booking: makeBooking(),
      actor: 'manager',
      start: at(MONDAY, '11:00'),
      scheduling: wrongScheduling,
    });

    expect(analysis.violations).toEqual([{ code: 'slot-does-not-fit-service' }]);
    expect(analysis.warnings).toEqual([]);
  });
});
