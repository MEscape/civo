import { describe, expect, it } from 'vitest';

import { assessEligibility } from '@modules/booking/domain/assignment/assignment-eligibility';
import {
  assignResource,
  releaseAssignment,
} from '@modules/booking/domain/assignment/booking-assignment';
import { analyzeChange } from '@modules/booking/domain/impact/analyze-change';
import {
  cancelBooking,
  rescheduleBooking,
} from '@modules/booking/domain/lifecycle/booking-lifecycle';
import type { Booking } from '@modules/booking/domain/models/booking';
import { toBookableResourceId } from '@modules/booking/domain/models/ids';
import { assessSlot } from '@modules/booking/domain/scheduling/slot-engine';

import {
  MONDAY,
  NOW,
  WORKDAY,
  employee,
  makeBooking,
  makeService,
  minutes,
  schedule,
  schedulingFor,
  unitOf,
} from '../support/booking-fixtures';
import { at, between } from '../support/time-fixtures';

const SERVICE = makeService();
const CONTEXT = { service: SERVICE, now: NOW };

describe('the analysis and the operation never disagree', () => {
  const scheduling = schedulingFor(SERVICE, [
    schedule('anna', [WORKDAY]),
    schedule('ben', [WORKDAY], [between(MONDAY, '11:00', '12:00')]),
  ]);

  it('cancellation: blocked exactly when the operation refuses', () => {
    const cases: Array<{
      booking: Booking;
      actor: 'customer' | 'employee' | 'manager';
      now: typeof NOW;
    }> = [
      { booking: makeBooking(), actor: 'customer', now: NOW },
      { booking: makeBooking(), actor: 'customer', now: at(MONDAY, '09:30') },
      { booking: makeBooking(), actor: 'employee', now: at(MONDAY, '09:30') },
      { booking: makeBooking({ status: 'completed' }), actor: 'manager', now: NOW },
      {
        booking: makeBooking({
          status: 'held',
          customer: null,
          holdExpiresAt: at(MONDAY, '00:00'),
        }),
        actor: 'customer',
        now: NOW,
      },
    ];
    for (const { booking, actor, now } of cases) {
      const analysis = analyzeChange({ service: SERVICE, now }, { kind: 'cancel', booking, actor });
      expect(analysis.isBlocked).toBe(
        cancelBooking({ booking, service: SERVICE, actor, now }).isErr(),
      );
    }
  });

  it('rescheduling: blocked exactly when the operation, with the slot the engine gave, refuses', () => {
    for (const time of ['09:00', '11:00', '16:30']) {
      for (const actor of ['customer', 'manager'] as const) {
        for (const booking of [
          makeBooking(),
          makeBooking({ rescheduleCount: 3 }),
          makeBooking({ status: 'completed' }),
        ]) {
          const analysis = analyzeChange(CONTEXT, {
            kind: 'reschedule',
            booking,
            actor,
            start: at(MONDAY, time),
            scheduling,
          });
          const assessment = assessSlot(scheduling, at(MONDAY, time));
          const refused =
            assessment.kind === 'rejected' ||
            rescheduleBooking({
              booking,
              service: SERVICE,
              slot: assessment.slot,
              actor,
              now: NOW,
            }).isErr();
          expect(analysis.isBlocked).toBe(refused);
        }
      }
    }
  });

  it('assignment and hand-back: blocked exactly when the operation refuses', () => {
    const open = makeBooking({ assignments: [unitOf(null)] });
    const taken = makeBooking({ assignments: [unitOf('anna')] });
    const openService = makeService({ assignmentMode: 'open' });
    const people = [
      { resource: employee('ben'), schedule: schedule('ben', [WORKDAY]) },
      { resource: employee('anna'), schedule: schedule('anna', [WORKDAY]) },
      { resource: employee('carl', { skills: [] }), schedule: schedule('carl', [WORKDAY]) },
    ];
    for (const booking of [open, taken]) {
      for (const candidate of people) {
        const analysis = analyzeChange(
          { service: openService, now: NOW },
          { kind: 'assign', booking, requirementIndex: 0, candidate },
        );
        const assessment = assessEligibility({
          now: NOW,
          booking,
          requirement: openService.requirements[0] ?? {
            resourceType: 'employee',
            skills: [],
            count: 1,
            resourceIds: null,
          },
          requirementIndex: 0,
          candidate,
        });
        const refused =
          assessment.kind === 'ineligible' ||
          assignResource({ booking, candidate: assessment.candidate, now: NOW }).isErr();
        expect(analysis.isBlocked).toBe(refused);
      }
      for (const id of ['anna', 'ben']) {
        const resourceId = toBookableResourceId(id);
        // The booking begins on Monday at 10:00: from then on nobody hands it back.
        for (const [service, now] of [
          [openService, NOW],
          [SERVICE, NOW],
          [openService, at(MONDAY, '10:00')],
        ] as const) {
          const analysis = analyzeChange(
            { service, now },
            { kind: 'unassign', booking, resourceId },
          );
          expect(analysis.isBlocked).toBe(
            releaseAssignment({ booking, service, resourceId, now }).isErr(),
          );
        }
      }
    }
    expect(minutes(0)).toBe(0);
  });
});
