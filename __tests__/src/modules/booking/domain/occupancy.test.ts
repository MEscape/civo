import { describe, expect, it } from 'vitest';

import {
  hullOf,
  marginsOf,
  occupancyOf,
  spanWithMargins,
} from '@modules/booking/domain/scheduling/occupancy';
import type { OccupancySubject } from '@modules/booking/domain/scheduling/occupancy';
import { prepareScheduling } from '@modules/booking/domain/scheduling/prepare-scheduling';
import { assessSlot, findSlots } from '@modules/booking/domain/scheduling/slot-engine';
import { appointmentAt } from '@modules/booking/domain/scheduling/slot-rules';
import { createStartWindow } from '@modules/booking/domain/scheduling/start-window';
import { createLocalDateRange } from '@modules/booking/domain/time/local-date-range';

import { MONDAY, NOW, minutes } from '../support/booking-fixtures';
import { BERLIN, at, between, clock, day, rulesOf, unwrap } from '../support/time-fixtures';

/** The passport counter of the service form: 20 minutes, 5 before and 10 after for the employee. */
const RULES = rulesOf({ durationMinutes: 20, preparationMinutes: 5, cleanupMinutes: 10 });

const anna: OccupancySubject = {
  id: 'anna',
  isEmployee: true,
  setupMinutes: minutes(0),
  teardownMinutes: minutes(0),
};
const room = (setup: number, teardown: number): OccupancySubject => ({
  id: 'room',
  isEmployee: false,
  setupMinutes: minutes(setup),
  teardownMinutes: minutes(teardown),
});

const show = (span: { start: Parameters<typeof clock>[0]; end: Parameters<typeof clock>[0] }) =>
  `${clock(span.start).slice(11)}-${clock(span.end).slice(11)}`;

describe('who is occupied when', () => {
  const start = at(MONDAY, '13:00');

  it('holds the citizen for the appointment and the employee for preparation and clean-up', () => {
    const occupancy = occupancyOf(start, RULES, [anna]);

    expect(show(occupancy.citizen)).toBe('13:00-13:20');
    expect(show(occupancy.employee)).toBe('12:55-13:30');
    expect(occupancy.resources.map((party) => show(party.span))).toEqual(['12:55-13:30']);
    expect(show(occupancy.hull)).toBe('12:55-13:30');
  });

  it('holds a room for the appointment only, whatever the staff buffers say', () => {
    const occupancy = occupancyOf(start, RULES, [room(0, 0)]);

    expect(occupancy.resources.map((party) => show(party.span))).toEqual(['13:00-13:20']);
    // The employee span is still known, for the preview of a service with an employee.
    expect(show(occupancy.employee)).toBe('12:55-13:30');
    expect(show(occupancy.hull)).toBe('13:00-13:20');
  });

  it('holds a room for its own setup and teardown, not for the service’s buffers', () => {
    const occupancy = occupancyOf(start, RULES, [anna, room(15, 5)]);

    expect(occupancy.resources.map((party) => `${party.id} ${show(party.span)}`)).toEqual([
      'anna 12:55-13:30',
      'room 12:45-13:25',
    ]);
    expect(show(occupancy.hull)).toBe('12:45-13:30');
  });

  it('has margins by kind, and spans and a hull that follow from them', () => {
    expect(marginsOf(anna, RULES)).toEqual({ before: minutes(5), after: minutes(10) });
    expect(marginsOf(room(3, 4), RULES)).toEqual({ before: minutes(3), after: minutes(4) });
    expect(
      show(spanWithMargins(appointmentAt(start, RULES), { before: minutes(5), after: minutes(0) })),
    ).toBe('12:55-13:20');
    expect(hullOf([])).toBeNull();
  });
});

describe('the engine holds every resource for what the occupancy says', () => {
  const rules = RULES;

  function schedulingWith(options: {
    readonly room: { busy: Array<ReturnType<typeof between>>; margins: [number, number] };
  }) {
    const range = createLocalDateRange(day(MONDAY), day(MONDAY), 62);
    if (range === null) {
      throw new Error('fixture: range');
    }
    const workday = between(MONDAY, '08:00', '17:00');
    const [setup, teardown] = options.room.margins;
    return unwrap(
      prepareScheduling({
        zone: BERLIN,
        range,
        rules,
        startWindow: unwrap(
          createStartWindow({ now: NOW, zone: BERLIN, noticeMinutes: 0, horizonDays: 30 }),
        ),
        openWindows: [workday],
        requirements: [
          {
            count: 1,
            resources: [
              {
                id: 'anna',
                availability: [workday],
                busy: [],
                margins: marginsOf(anna, rules),
              },
            ],
          },
          {
            count: 1,
            resources: [
              {
                id: 'room',
                availability: [workday],
                busy: options.room.busy,
                margins: marginsOf(room(setup, teardown), rules),
              },
            ],
          },
        ],
      }),
    );
  }

  it('plans the same spans the preview shows', () => {
    const scheduling = schedulingWith({ room: { busy: [], margins: [15, 5] } });
    const start = at(MONDAY, '13:00');

    const assessment = assessSlot(scheduling, start);
    if (assessment.kind !== 'planned') {
      throw new Error('expected a planned slot');
    }
    const occupancy = occupancyOf(start, rules, [anna, room(15, 5)]);

    expect(assessment.slot.resourceSpans).toEqual({
      anna: occupancy.resources[0]?.span,
      room: occupancy.resources[1]?.span,
    });
    expect(assessment.slot.occupied).toEqual(occupancy.hull);
  });

  it('does not let the employee’s preparation block a room that is free for the appointment', () => {
    // The room is taken until 13:00. The employee starts preparing at 12:55, the room is needed
    // from 13:00: the room’s own setup is zero, so the slot stands.
    const scheduling = schedulingWith({
      room: { busy: [between(MONDAY, '12:00', '13:00')], margins: [0, 0] },
    });

    expect(assessSlot(scheduling, at(MONDAY, '13:00')).kind).toBe('planned');
  });

  it('holds a room for its own setup: a room busy until 12:50 is not free for a start at 13:00', () => {
    const scheduling = schedulingWith({
      room: { busy: [between(MONDAY, '12:00', '12:50')], margins: [15, 0] },
    });

    expect(assessSlot(scheduling, at(MONDAY, '13:00'))).toEqual({
      kind: 'rejected',
      reason: 'resources-unavailable',
    });
    expect(assessSlot(scheduling, at(MONDAY, '13:30')).kind).toBe('planned');
    expect(findSlots(scheduling).length).toBeGreaterThan(0);
  });

  it('holds a resource without margins like staff, for the service’s own buffers', () => {
    const range = createLocalDateRange(day(MONDAY), day(MONDAY), 62);
    if (range === null) {
      throw new Error('fixture: range');
    }
    const workday = between(MONDAY, '08:00', '17:00');
    const scheduling = unwrap(
      prepareScheduling({
        zone: BERLIN,
        range,
        rules,
        startWindow: unwrap(
          createStartWindow({ now: NOW, zone: BERLIN, noticeMinutes: 0, horizonDays: 30 }),
        ),
        openWindows: [workday],
        requirements: [
          { count: 1, resources: [{ id: 'anna', availability: [workday], busy: [] }] },
        ],
      }),
    );
    const assessment = assessSlot(scheduling, at(MONDAY, '13:00'));
    if (assessment.kind !== 'planned') {
      throw new Error('expected a planned slot');
    }

    expect(show(assessment.slot.resourceSpans['anna'] ?? assessment.slot.occupied)).toBe(
      '12:55-13:30',
    );
  });
});
