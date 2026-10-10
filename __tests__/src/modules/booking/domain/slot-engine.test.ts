import { describe, expect, it } from 'vitest';

import { assessSlot, evaluateSlot } from '@modules/booking/domain/scheduling/slot-assessment';
import { findAvailableSlots } from '@modules/booking/domain/scheduling/slot-finder';

import {
  BERLIN,
  at,
  indexFor,
  NOW,
  makeBooking,
  makeLocation,
  makeResource,
  makeService,
  plan,
  hours,
  range,
  times,
  weekdays,
} from '../support/fixtures';

const MONDAY = '2027-01-11';

function slotsOf(options: Parameters<typeof indexFor>[0], participants = 1) {
  return times(findAvailableSlots(indexFor(options), participants));
}

describe('opening hours and slot grid', () => {
  it('offers every grid point whose appointment fits inside the opening hours', () => {
    const slots = slotsOf({ location: makeLocation({ openingHours: weekdays('09:00', '11:00') }) });
    expect(slots).toEqual(['09:00', '09:30', '10:00', '10:30']);
  });

  it('offers nothing on a day the location is closed', () => {
    const index = indexFor({}, range('2027-01-16', '2027-01-17'));
    expect(findAvailableSlots(index)).toEqual([]);
  });

  it('never offers a slot that would run past closing time', () => {
    const slots = slotsOf({
      service: makeService({ durationMinutes: 45, slotIntervalMinutes: 15 }),
      location: makeLocation({ openingHours: weekdays('09:00', '10:00') }),
    });
    expect(slots).toEqual(['09:00', '09:15']);
  });

  it('removes breaks from the opening hours', () => {
    const slots = slotsOf({
      location: makeLocation({
        openingHours: weekdays('09:00', '13:00', [{ start: '11:00', end: '12:00' }]),
      }),
    });
    expect(slots).toEqual(['09:00', '09:30', '10:00', '10:30', '12:00', '12:30']);
  });

  it('applies the service availability on top of the location hours', () => {
    const slots = slotsOf({
      service: makeService({ availability: weekdays('10:00', '11:00') }),
    });
    expect(slots).toEqual(['10:00', '10:30']);
  });

  it('rejects an off-grid start', () => {
    const index = indexFor();
    expect(assessSlot(index, at(MONDAY, '09:10'), 1)).toEqual({
      kind: 'rejected',
      reason: 'off-grid',
    });
  });

  it('tells a closed location from an unavailable service', () => {
    const closed = indexFor({}, range('2027-01-16', '2027-01-16'));
    expect(assessSlot(closed, at('2027-01-16', '10:00'), 1)).toMatchObject({
      reason: 'location-closed',
    });
    const restricted = indexFor({
      service: makeService({ availability: weekdays('10:00', '11:00') }),
    });
    expect(assessSlot(restricted, at(MONDAY, '14:00'), 1)).toMatchObject({
      reason: 'service-unavailable',
    });
  });
});

describe('holidays, absences and exceptions', () => {
  it('closes a location on a holiday', () => {
    const openingHours = plan({ 1: hours('08:00', '12:00') }, [
      { kind: 'closed', from: MONDAY, to: MONDAY, label: 'Holiday' },
    ]);
    const index = indexFor({ location: makeLocation({ openingHours }) });
    expect(findAvailableSlots(index)).toEqual([]);
  });

  it('lets an override replace the weekly hours for a date', () => {
    const openingHours = plan({ 1: hours('08:00', '18:00') }, [
      { kind: 'override', from: MONDAY, to: MONDAY, day: hours('10:00', '11:00') },
    ]);
    expect(slotsOf({ location: makeLocation({ openingHours }) })).toEqual(['10:00', '10:30']);
  });

  it('lets an additional interval open a normally closed day', () => {
    const openingHours = plan({}, [
      { kind: 'additional', from: MONDAY, to: MONDAY, day: hours('09:00', '10:00') },
    ]);
    expect(slotsOf({ location: makeLocation({ openingHours }) })).toEqual(['09:00', '09:30']);
  });

  it('removes a resource that is absent for the day while others still serve', () => {
    const absent = makeResource('emp-1', {
      availability: plan({ 1: hours('08:00', '18:00') }, [
        { kind: 'closed', from: MONDAY, to: MONDAY, label: 'Sick' },
      ]),
    });
    const present = makeResource('emp-2', { availability: weekdays('09:00', '10:00') });
    expect(slotsOf({ resources: [absent, present] })).toEqual(['09:00', '09:30']);
    expect(slotsOf({ resources: [absent] })).toEqual([]);
  });

  it('honours a resource whose own hours are narrower than the location', () => {
    const resource = makeResource('emp-1', { availability: weekdays('13:00', '14:00') });
    expect(slotsOf({ resources: [resource] })).toEqual(['13:00', '13:30']);
  });

  it('never offers time while the location is closed even if the resource has hours', () => {
    const resource = makeResource('emp-1', { availability: weekdays('06:00', '20:00') });
    const slots = slotsOf({ resources: [resource] });
    expect(slots[0]).toBe('08:00');
    expect(slots.at(-1)).toBe('17:30');
  });
});

describe('buffers', () => {
  const service = makeService({ preparationMinutes: 15, cleanupMinutes: 15 });

  it('needs the resource for preparation and clean-up, not only the appointment', () => {
    const slots = slotsOf({
      service,
      location: makeLocation({ openingHours: weekdays('09:00', '10:00') }),
    });
    // 09:00 would need preparation from 08:45; 09:30 would need clean-up until 10:15.
    expect(slots).toEqual([]);
  });

  it('allows the first start once the opening time leaves room for preparation', () => {
    const slots = slotsOf({
      service,
      resources: [makeResource('emp-1', { availability: weekdays('08:45', '10:15') })],
      location: makeLocation({ openingHours: weekdays('08:00', '18:00') }),
    });
    expect(slots).toEqual(['09:00', '09:30']);
  });

  it('keeps a following appointment away from the clean-up of the previous one', () => {
    const first = makeBooking({ service, start: at(MONDAY, '10:00'), resources: ['emp-1'] });
    const slots = slotsOf({
      service: makeService({ ...service, slotIntervalMinutes: 15 }),
      bookings: [first],
      location: makeLocation({ openingHours: weekdays('09:00', '12:00') }),
    });
    // Previous occupies 09:45-10:45; next occupied span must start at or after 10:45.
    expect(slots).not.toContain('10:15');
    expect(slots).not.toContain('10:30');
    expect(slots).toContain('11:15');
    expect(slots).not.toContain('09:15');
  });
});

describe('existing bookings', () => {
  it('blocks the booked time for the only resource', () => {
    const booking = makeBooking({ start: at(MONDAY, '09:00'), resources: ['emp-1'] });
    const slots = slotsOf({
      bookings: [booking],
      location: makeLocation({ openingHours: weekdays('09:00', '11:00') }),
    });
    expect(slots).toEqual(['09:30', '10:00', '10:30']);
  });

  it('does not block when another resource of the pool is free', () => {
    const booking = makeBooking({ start: at(MONDAY, '09:00'), resources: ['emp-1'] });
    const slots = slotsOf({
      bookings: [booking],
      resources: [makeResource('emp-1'), makeResource('emp-2')],
      location: makeLocation({ openingHours: weekdays('09:00', '10:00') }),
    });
    expect(slots).toEqual(['09:00', '09:30']);
  });

  it('ignores cancelled, expired and finished bookings', () => {
    const bookings = (['cancelled', 'expired', 'completed', 'no_show'] as const).map((status) =>
      makeBooking({ start: at(MONDAY, '09:00'), resources: ['emp-1'], status }),
    );
    const slots = slotsOf({
      bookings,
      location: makeLocation({ openingHours: weekdays('09:00', '09:30') }),
    });
    // Completed and no-show bookings are history, but do still not block: they are in the past.
    expect(slots).toEqual(['09:00']);
  });

  it('blocks while a hold is live and releases once it has expired', () => {
    const live = makeBooking({ start: at(MONDAY, '09:00'), resources: ['emp-1'], status: 'held' });
    const options = { location: makeLocation({ openingHours: weekdays('09:00', '09:30') }) };
    expect(slotsOf({ ...options, bookings: [live] })).toEqual([]);

    const expired = makeBooking({
      start: at(MONDAY, '09:00'),
      resources: ['emp-1'],
      status: 'held',
      holdExpiresAt: new Date(NOW.getTime() - 1000),
    });
    expect(slotsOf({ ...options, bookings: [expired] })).toEqual(['09:00']);
  });

  it('lets a booking being moved not block its own new time', () => {
    const booking = makeBooking({ id: 'moving', start: at(MONDAY, '09:00'), resources: ['emp-1'] });
    const input = {
      bookings: [booking],
      location: makeLocation({ openingHours: weekdays('09:00', '09:30') }),
    };
    expect(findAvailableSlots(indexFor(input))).toEqual([]);
    expect(times(findAvailableSlots(indexFor({ ...input, ignoreBookingId: booking.id })))).toEqual([
      '09:00',
    ]);
  });
});

describe('notice period and booking horizon', () => {
  it('hides starts earlier than now plus the notice', () => {
    const slots = slotsOf({
      now: new Date(at(MONDAY, '08:00')),
      service: makeService({ noticeMinutes: 120 }),
      location: makeLocation({ openingHours: weekdays('08:00', '12:00') }),
    });
    expect(slots).toEqual(['10:00', '10:30', '11:00', '11:30']);
  });

  it('hides days beyond the horizon', () => {
    const index = indexFor(
      { service: makeService({ horizonDays: 7 }) },
      range('2027-01-04', '2027-01-20'),
    );
    const days = new Set(
      findAvailableSlots(index).map((slot) => new Date(slot.start).toISOString().slice(0, 10)),
    );
    expect(days.has('2027-01-11')).toBe(true);
    expect(days.has('2027-01-12')).toBe(false);
  });

  it('reports the reason for a start outside the window', () => {
    const index = indexFor({
      service: makeService({ noticeMinutes: 24 * 60 }),
      now: new Date(at(MONDAY, '08:00')),
    });
    expect(assessSlot(index, at(MONDAY, '10:00'), 1)).toMatchObject({
      reason: 'outside-booking-window',
    });
  });
});

describe('resource pools, skills and requirements', () => {
  it('requires every skill of a requirement', () => {
    const service = makeService({
      requirements: [
        {
          resourceType: 'employee',
          skills: ['passport', 'biometrics'],
          count: 1,
          resourceIds: null,
        },
      ],
    });
    const partly = makeResource('emp-1', { skills: ['passport'] });
    const fully = makeResource('emp-2', {
      skills: ['passport', 'biometrics'],
      availability: weekdays('10:00', '11:00'),
    });
    expect(slotsOf({ service, resources: [partly] })).toEqual([]);
    expect(slotsOf({ service, resources: [partly, fully] })).toEqual(['10:00', '10:30']);
  });

  it('restricts a requirement to the listed resources', () => {
    const service = makeService({
      requirements: [
        {
          resourceType: 'employee',
          skills: [],
          count: 1,
          resourceIds: [makeResource('emp-2').id],
        },
      ],
    });
    const options = {
      service,
      resources: [
        makeResource('emp-1'),
        makeResource('emp-2', { availability: weekdays('12:00', '13:00') }),
      ],
    };
    expect(slotsOf(options)).toEqual(['12:00', '12:30']);
  });

  it('needs two different resources for two requirements and finds the assignment greedy choice would miss', () => {
    const service = makeService({
      requirements: [
        { resourceType: 'employee', skills: ['a'], count: 1, resourceIds: null },
        { resourceType: 'employee', skills: [], count: 1, resourceIds: null },
      ],
    });
    // emp-1 has skill a and could fill either demand; emp-2 can only fill the unskilled one.
    const resources = [makeResource('emp-1', { skills: ['a'] }), makeResource('emp-2')];
    const index = indexFor({ service, resources });
    const result = assessSlot(index, at(MONDAY, '09:00'), 1);
    expect(result.kind).toBe('planned');
    if (result.kind === 'planned') {
      expect(result.slot.resourceIds).toEqual(['emp-1', 'emp-2']);
    }
  });

  it('is unavailable when one required resource is missing', () => {
    const service = makeService({
      requirements: [
        { resourceType: 'employee', skills: [], count: 1, resourceIds: null },
        { resourceType: 'room', skills: [], count: 1, resourceIds: null },
      ],
    });
    expect(slotsOf({ service, resources: [makeResource('emp-1')] })).toEqual([]);
    expect(
      slotsOf({
        service,
        resources: [makeResource('emp-1'), makeResource('room-1', { type: 'room' })],
      }).length,
    ).toBeGreaterThan(0);
  });

  it('needs a count of several units from one pool', () => {
    const service = makeService({
      requirements: [{ resourceType: 'employee', skills: [], count: 2, resourceIds: null }],
    });
    expect(slotsOf({ service, resources: [makeResource('emp-1')] })).toEqual([]);
    expect(
      slotsOf({ service, resources: [makeResource('emp-1'), makeResource('emp-2')] }).length,
    ).toBeGreaterThan(0);
  });

  it('ignores inactive resources and resources of another location', () => {
    const resources = [
      makeResource('emp-1', { isActive: false }),
      makeResource('emp-2', { locationId: makeLocation({}).id }),
    ];
    expect(slotsOf({ resources: [resources[0] as never] })).toEqual([]);
    expect(slotsOf({ resources: [resources[1] as never] }).length).toBeGreaterThan(0);
  });

  it('spreads bookings over the pool: the less busy resource is chosen', () => {
    const busyOne = makeBooking({ start: at(MONDAY, '08:00'), resources: ['emp-1'] });
    const index = indexFor({
      bookings: [busyOne],
      resources: [makeResource('emp-1'), makeResource('emp-2')],
    });
    const result = assessSlot(index, at(MONDAY, '10:00'), 1);
    expect(result.kind === 'planned' && result.slot.resourceIds).toEqual(['emp-2']);
  });

  it('chooses deterministically between equally loaded resources', () => {
    const resources = [makeResource('b'), makeResource('a'), makeResource('c')];
    const first = assessSlot(indexFor({ resources }), at(MONDAY, '10:00'), 1);
    const second = assessSlot(
      indexFor({ resources: [...resources].reverse() }),
      at(MONDAY, '10:00'),
      1,
    );
    expect(first).toEqual(second);
    expect(first.kind === 'planned' && first.slot.resourceIds).toEqual(['a']);
  });
});

describe('capacity', () => {
  const service = makeService({
    capacity: { participantsPerBooking: 4, participantsPerSession: 10 },
    requirements: [{ resourceType: 'room', skills: [], count: 1, resourceIds: null }],
  });
  const room = (capacity: number | null) => makeResource('room-1', { type: 'room', capacity });

  it('rejects a group larger than the service allows per booking', () => {
    const index = indexFor({ service, resources: [room(null)] });
    expect(assessSlot(index, at(MONDAY, '10:00'), 5)).toMatchObject({
      reason: 'invalid-participants',
    });
    expect(assessSlot(index, at(MONDAY, '10:00'), 0)).toMatchObject({
      reason: 'invalid-participants',
    });
    expect(assessSlot(index, at(MONDAY, '10:00'), 1.5)).toMatchObject({
      reason: 'invalid-participants',
    });
  });

  it('rejects a group the room cannot hold', () => {
    const index = indexFor({ service, resources: [room(3)] });
    expect(assessSlot(index, at(MONDAY, '10:00'), 4)).toMatchObject({
      reason: 'capacity-exceeded',
    });
    expect(assessSlot(index, at(MONDAY, '10:00'), 3).kind).toBe('planned');
  });

  it('limits a session by the smallest resource capacity', () => {
    const index = indexFor({ service, resources: [room(6)] });
    const result = assessSlot(index, at(MONDAY, '10:00'), 2);
    expect(result.kind === 'planned' && result.slot.sessionCapacity).toBe(6);
  });

  it('lets several bookings share one session until it is full', () => {
    const first = makeBooking({
      service,
      start: at(MONDAY, '10:00'),
      resources: ['room-1'],
      participants: 4,
    });
    const second = makeBooking({
      service,
      start: at(MONDAY, '10:00'),
      resources: ['room-1'],
      participants: 4,
    });
    const options = { service, resources: [room(null)] };
    const open = assessSlot(indexFor({ ...options, bookings: [first] }), at(MONDAY, '10:00'), 4);
    expect(open.kind === 'planned' && open.slot.joinsExistingSession).toBe(true);
    expect(open.kind === 'planned' && open.slot.remainingParticipants).toBe(6);

    const full = assessSlot(
      indexFor({ ...options, bookings: [first, second] }),
      at(MONDAY, '10:00'),
      3,
    );
    expect(full).toMatchObject({ reason: 'capacity-exceeded' });
    expect(
      assessSlot(indexFor({ ...options, bookings: [first, second] }), at(MONDAY, '10:00'), 2).kind,
    ).toBe('planned');
  });

  it('does not let a different start overlap a session that holds the room', () => {
    const long = makeService({ ...service, durationMinutes: 60 });
    const first = makeBooking({
      service: long,
      start: at(MONDAY, '10:00'),
      resources: ['room-1'],
      participants: 2,
    });
    const index = indexFor({ service: long, resources: [room(null)], bookings: [first] });
    expect(assessSlot(index, at(MONDAY, '10:30'), 1)).toMatchObject({
      reason: 'resources-unavailable',
    });
  });

  it('a service that holds its resources alone never shares a session', () => {
    const solo = makeService();
    const booking = makeBooking({ start: at(MONDAY, '10:00'), resources: ['emp-1'] });
    const index = indexFor({ service: solo, bookings: [booking] });
    expect(assessSlot(index, at(MONDAY, '10:00'), 1)).toMatchObject({
      reason: 'resources-unavailable',
    });
  });
});

describe('evaluateSlot', () => {
  it('maps rejections to stable error codes', () => {
    const index = indexFor();
    const code = (start: number, participants = 1) => {
      const result = evaluateSlot(index, start, participants);
      return result.isErr() ? result.error.code : 'ok';
    };
    expect(code(at(MONDAY, '09:10'))).toBe('booking.slot_unavailable');
    expect(code(at(MONDAY, '23:00'))).toBe('booking.slot_unavailable');
    expect(code(at(MONDAY, '09:00'), 0)).toBe('booking.validation_failed');
    expect(code(at(MONDAY, '09:00'))).toBe('ok');
  });

  it('reports a taken time as a resource conflict', () => {
    const booking = makeBooking({ start: at(MONDAY, '09:00'), resources: ['emp-1'] });
    const result = evaluateSlot(indexFor({ bookings: [booking] }), at(MONDAY, '09:00'), 1);
    expect(result.isErr() && result.error.code).toBe('booking.resource_unavailable');
  });
});

describe('purity', () => {
  it('returns the same slots for the same input', () => {
    const options = { resources: [makeResource('a'), makeResource('b')] };
    expect(findAvailableSlots(indexFor(options))).toEqual(findAvailableSlots(indexFor(options)));
  });

  it('does not mutate its input', () => {
    const bookings = [makeBooking({ start: at(MONDAY, '09:00'), resources: ['emp-1'] })];
    const snapshot = JSON.stringify(bookings);
    findAvailableSlots(indexFor({ bookings }));
    expect(JSON.stringify(bookings)).toBe(snapshot);
  });

  it('reports the zone it formats in', () => {
    expect(BERLIN).toBe('Europe/Berlin');
  });
});
