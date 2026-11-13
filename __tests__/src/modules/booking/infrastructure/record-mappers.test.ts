import { describe, expect, it, vi } from 'vitest';

import { BOOKING_ERROR_CODES as CODES } from '@modules/booking/domain/errors/booking-errors';
import { toBookableResourceId } from '@modules/booking/domain/models/ids';
import { toAssignmentRows } from '@modules/booking/infrastructure/prisma/assignment-record-mapper';
import { toResource } from '@modules/booking/infrastructure/prisma/bookable-resource-record-mapper';
import type { ResourceRecord } from '@modules/booking/infrastructure/prisma/bookable-resource-record-mapper';
import { toService } from '@modules/booking/infrastructure/prisma/bookable-service-record-mapper';
import type { ServiceRecord } from '@modules/booking/infrastructure/prisma/bookable-service-record-mapper';
import { customerEmailOf } from '@modules/booking/infrastructure/prisma/booking-customer-record-mapper';
import { toLocation } from '@modules/booking/infrastructure/prisma/booking-location-record-mapper';
import {
  toBookingChanges,
  toBookingColumns,
  toStoredBooking,
} from '@modules/booking/infrastructure/prisma/booking-record-mapper';
import type { BookingRecord } from '@modules/booking/infrastructure/prisma/booking-record-mapper';

import {
  STORED_WORKING_WEEK as STORED_PLAN,
  makeBooking,
  unitOf,
} from '../support/booking-fixtures';
import { at } from '../support/time-fixtures';

// The auth barrel reaches the database and the session library; only its id constructor is used here.
vi.mock('@modules/auth', () => ({ toTenantId: (value: string) => value }));

// The edge to the database is faked: the mappers only convert between its text and `Date`.
vi.mock('@lib/db', () => ({
  instantToDate: (record: string) => new Date(record),
  dateToInstant: (date: Date) => date.toISOString(),
  toJsonValue: (value: unknown) => value,
}));

const iso = (text: string) => text;

function bookingRecord(overrides: Partial<BookingRecord> = {}): BookingRecord {
  return {
    id: 'b1',
    tenantId: 'site',
    serviceId: 's1',
    locationId: 'l1',
    reference: 'ABCDEFGH23',
    status: 'CONFIRMED',
    start: iso('2027-01-11T09:00:00Z') as never,
    end: iso('2027-01-11T09:30:00Z') as never,
    occupiedStart: iso('2027-01-11T09:00:00Z') as never,
    occupiedEnd: iso('2027-01-11T09:30:00Z') as never,
    participants: 1,
    sessionKey: 'booking:b1',
    sessionCapacity: 1,
    serviceSnapshot: null,
    customer: { email: 'a@example.org', firstName: null },
    holdExpiresAt: null,
    rescheduleCount: 0,
    cancelledAt: null,
    cancelledBy: null,
    createdAt: iso('2027-01-05T08:00:00Z') as never,
    updatedAt: iso('2027-01-05T08:00:00Z') as never,
    assignments: [
      {
        requirementIndex: 1,
        unitIndex: 0,
        resourceType: 'room',
        resourceId: 'room-1',
        occupiedStart: iso('2027-01-11T09:00:00Z') as never,
        occupiedEnd: iso('2027-01-11T09:30:00Z') as never,
      },
      {
        requirementIndex: 0,
        unitIndex: 1,
        resourceType: 'employee',
        resourceId: null,
        occupiedStart: iso('2027-01-11T09:00:00Z') as never,
        occupiedEnd: iso('2027-01-11T09:30:00Z') as never,
      },
      {
        requirementIndex: 0,
        unitIndex: 0,
        resourceType: 'employee',
        resourceId: 'anna',
        occupiedStart: iso('2027-01-11T09:00:00Z') as never,
        occupiedEnd: iso('2027-01-11T09:30:00Z') as never,
      },
    ],
    ...overrides,
  };
}

describe('reading a stored booking', () => {
  it('turns the record into the booking the rules know, units in order', () => {
    const { booking, placement } = toStoredBooking(bookingRecord())._unsafeUnwrap();

    expect(booking).toMatchObject({
      id: 'b1',
      status: 'confirmed',
      occupied: {
        start: Date.parse('2027-01-11T09:00:00Z'),
        end: Date.parse('2027-01-11T09:30:00Z'),
      },
      customer: { email: 'a@example.org' },
    });
    const held = {
      start: Date.parse('2027-01-11T09:00:00Z'),
      end: Date.parse('2027-01-11T09:30:00Z'),
    };
    expect(booking.assignments).toEqual([
      { requirementIndex: 0, resourceType: 'employee', resourceId: 'anna', occupied: held },
      { requirementIndex: 0, resourceType: 'employee', resourceId: null, occupied: held },
      { requirementIndex: 1, resourceType: 'room', resourceId: 'room-1', occupied: held },
    ]);
    expect(placement).toEqual({
      reference: 'ABCDEFGH23',
      participants: 1,
      sessionKey: 'booking:b1',
      sessionCapacity: 1,
      snapshot: null,
    });
  });

  it('reads a member the first version stored as null as absent', () => {
    const { booking } = toStoredBooking(bookingRecord())._unsafeUnwrap();

    expect(booking.customer).toEqual({ email: 'a@example.org' });
  });

  it('reads "staff", which the first version stored as the canceller, as a manager', () => {
    const record = bookingRecord({
      status: 'CANCELLED',
      cancelledAt: iso('2027-01-06T08:00:00Z') as never,
      cancelledBy: 'staff',
    });

    expect(toStoredBooking(record)._unsafeUnwrap().booking.cancelledBy).toBe('manager');
  });

  it.each<[string, Partial<BookingRecord>]>([
    ['a customer that is not an object', { customer: 'Julia' }],
    ['a customer with a member of the wrong type', { customer: { email: 5 } }],
    ['an actor nobody knows', { cancelledBy: 'robot' }],
    [
      'an expired hold that still has its expiry (the sweep and the domain must agree)',
      { status: 'EXPIRED', holdExpiresAt: iso('2027-01-11T08:00:00Z') as never },
    ],
    ['a confirmed booking without a customer', { customer: null }],
    [
      'a resource type nobody knows',
      {
        assignments: [
          {
            requirementIndex: 0,
            unitIndex: 0,
            resourceType: 'ufo',
            resourceId: 'x',
            occupiedStart: iso('2027-01-11T09:00:00Z') as never,
            occupiedEnd: iso('2027-01-11T09:30:00Z') as never,
          },
        ],
      },
    ],
    ['an instant outside the supported years', { start: iso('1800-01-01T00:00:00Z') as never }],
    ['an occupied span that is empty', { occupiedEnd: iso('2027-01-11T09:00:00Z') as never }],
  ])('refuses %s as an infrastructure failure', (_name, overrides) => {
    const result = toStoredBooking(bookingRecord(overrides));

    expect(result._unsafeUnwrapErr()).toMatchObject({
      kind: 'infrastructure',
      code: CODES.persistenceFailed,
    });
  });
});

describe('writing a booking', () => {
  const stored = {
    booking: makeBooking({
      assignments: [
        unitOf('zed'),
        unitOf(null),
        unitOf('anna'),
        unitOf('room', { requirementIndex: 1, resourceType: 'room' }),
      ],
    }),
    placement: {
      reference: 'ABCDEFGH23',
      participants: 1,
      sessionKey: 'booking:b',
      sessionCapacity: 1,
      snapshot: null,
    },
  };

  it('numbers the units of each requirement and asks for resources in id order, open units last', () => {
    const rows = toAssignmentRows(stored, 'site', new Set());

    expect(rows.map((row) => [row.resourceId, row.requirementIndex, row.unitIndex])).toEqual([
      ['anna', 0, 2],
      ['room', 1, 0],
      ['zed', 0, 0],
      [null, 0, 1],
    ]);
    expect(rows.every((row) => row.websiteId === 'site')).toBe(true);
    expect(rows.some((row) => row.usesPlace)).toBe(false);
  });

  it('marks the units of a resource with several places as taking a place', () => {
    const rows = toAssignmentRows(stored, 'site', new Set(['room']));

    expect(rows.filter((row) => row.usesPlace).map((row) => row.resourceId)).toEqual(['room']);
  });

  it.each([
    ['held', true],
    ['confirmed', true],
    ['cancelled', false],
    ['completed', false],
    ['no_show', false],
    ['expired', false],
  ] as const)('marks the units of a %s booking live: %s', (status, live) => {
    const rows = toAssignmentRows(
      { ...stored, booking: { ...stored.booking, status } },
      'site',
      new Set(),
    );

    expect(new Set(rows.map((row) => row.isActive))).toEqual(new Set([live]));
  });

  it('writes the status as the database spells it and the customer’s email in a form to search by', () => {
    const columns = toBookingColumns({
      ...stored,
      booking: {
        ...stored.booking,
        status: 'no_show',
        customer: { email: '  Julia@Example.ORG ' },
      },
    });

    expect(columns).toMatchObject({ status: 'NO_SHOW', customerEmail: 'julia@example.org' });
    expect(customerEmailOf(null)).toBeNull();
    expect(customerEmailOf({ firstName: 'Julia' })).toBeNull();
    expect(customerEmailOf({ email: '   ' })).toBeNull();
  });

  it('leaves the reference out of a change: it never changes', () => {
    expect(toBookingColumns(stored)).toHaveProperty('reference', 'ABCDEFGH23');
    expect(toBookingChanges(stored)).not.toHaveProperty('reference');
    expect(toBookingChanges(stored)).toHaveProperty('sessionKey', 'booking:b');
  });

  it('keeps open units open and the instants as text with their offset', () => {
    const [row] = toAssignmentRows(
      { ...stored, booking: { ...stored.booking, assignments: [unitOf(null)] } },
      'site',
      new Set(),
    );

    expect(row).toMatchObject({
      resourceId: null,
      occupiedStart: new Date(at('2027-01-11', '10:00')).toISOString(),
    });
  });
});

const requirement = (count: number) => ({
  resourceType: 'employee',
  skills: [],
  count,
  resourceIds: null,
});

describe('reading the setup of a website', () => {
  const policy = { isAllowed: true, deadlineMinutes: 60, allowedActors: ['customer', 'staff'] };
  const service = (overrides: Partial<ServiceRecord> = {}): ServiceRecord => ({
    id: 's1',
    name: 'Reisepass',
    isActive: true,
    durationMinutes: 30,
    preparationMinutes: 5,
    cleanupMinutes: 5,
    slotIntervalMinutes: 15,
    noticeMinutes: 60,
    horizonDays: 30,
    requirements: [
      { resourceType: 'employee', skills: ['ausweise'], count: 1, resourceIds: ['anna'] },
    ],
    cancellation: policy,
    rescheduling: policy,
    information: [{ field: 'email', isRequired: true }],
    assignmentMode: 'open',
    availability: null,
    ...overrides,
  });

  it('turns a service row into the service the rules know', () => {
    expect(toService(service(), [])._unsafeUnwrap()).toMatchObject({
      id: 's1',
      rules: { durationMinutes: 30, preparationMinutes: 5, cleanupMinutes: 5, stepMinutes: 15 },
      noticeMinutes: 60,
      locations: [],
      requirements: [
        { resourceType: 'employee', skills: ['ausweise'], count: 1, resourceIds: ['anna'] },
      ],
      information: [{ field: 'email', isRequired: true }],
      assignmentMode: 'open',
    });
  });

  it('reads the "staff" of the first version as employee and manager, once', () => {
    const { cancellation } = toService(
      service({ cancellation: { ...policy, allowedActors: ['employee', 'staff'] } }),
      [],
    )._unsafeUnwrap();

    expect(cancellation.allowedActors).toEqual(['employee', 'manager']);
  });

  it.each([
    ['rules that fail the slot limits', { durationMinutes: 1 }],
    ['a notice that is not minutes', { noticeMinutes: -1 }],
    ['an assignment mode nobody knows', { assignmentMode: 'lottery' }],
    ['requirements of the wrong shape', { requirements: [{ resourceType: 'ufo' }] }],
    ['a requirement that asks for no unit', { requirements: [requirement(0)] }],
    [
      'a requirement that asks for more than the engine accepts',
      { requirements: [requirement(21)] },
    ],
    [
      'more requirements than the engine accepts',
      { requirements: Array.from({ length: 7 }, () => requirement(1)) },
    ],
    ['a horizon of no days', { horizonDays: 0 }],
    ['a horizon beyond the supported', { horizonDays: 731 }],
    ['a policy of the wrong shape', { cancellation: { isAllowed: 'yes' } }],
    [
      'a policy with an actor nobody knows',
      { rescheduling: { ...policy, allowedActors: ['robot'] } },
    ],
    [
      'a policy with a deadline that is not minutes',
      { cancellation: { ...policy, deadlineMinutes: -5 } },
    ],
    [
      'information fields nobody asks for',
      { information: [{ field: 'shoeSize', isRequired: true }] },
    ],
  ])('refuses a service with %s', (_name, overrides) => {
    expect(
      toService(service(overrides as Partial<ServiceRecord>), [])._unsafeUnwrapErr(),
    ).toMatchObject({
      kind: 'infrastructure',
      code: CODES.persistenceFailed,
    });
  });

  const resourceRecord = (overrides: Partial<ResourceRecord> = {}): ResourceRecord => ({
    coverage: null,
    id: 'r1',
    name: 'Raum 1',
    capacity: null,
    locationId: null,
    type: 'room',
    skills: [],
    isActive: true,
    setupMinutes: 0,
    teardownMinutes: 0,
    availability: null,
    ...overrides,
  });

  it('reads resources, with or without a location or a plan of their own', () => {
    expect(toResource(resourceRecord({ isActive: false }))._unsafeUnwrap()).toEqual({
      id: toBookableResourceId('r1'),
      name: 'Raum 1',
      capacity: null,
      type: 'room',
      skills: [],
      locationId: null,
      isActive: false,
      setupMinutes: 0,
      teardownMinutes: 0,
      availability: null,
      coverage: [],
    });
    const employee = toResource(
      resourceRecord({
        id: 'r2',
        locationId: 'l1',
        type: 'employee',
        skills: ['a'],
        availability: STORED_PLAN,
      }),
    )._unsafeUnwrap();
    expect(employee.locationId).toBe('l1');
    expect(employee.availability?.weekly[1].ranges).toEqual([
      { startMinute: 480, endMinute: 1020 },
    ]);
  });

  it.each([
    ['a type nobody knows', { type: 'ufo' }],
    ['skills that are not a list of text', { skills: 'a' }],
    ['a plan of the wrong shape', { availability: { weekly: [] } }],
    ['a setup that is not minutes', { setupMinutes: -1 }],
  ])('refuses a resource with %s', (_name, overrides) => {
    expect(toResource(resourceRecord(overrides)).isErr()).toBe(true);
  });

  it('reads a location\u2019s zone and opening hours, and refuses what it cannot', () => {
    const location = toLocation({
      id: 'l1',
      name: 'Rathaus',
      address: null,
      timeZone: 'Europe/Berlin',
      isActive: true,
      openingHours: STORED_PLAN,
    })._unsafeUnwrap();

    expect(location).toMatchObject({ id: 'l1', zone: 'Europe/Berlin', isActive: true });
    expect(location.openingHours.weekly[6].ranges).toEqual([]);
    expect(
      toLocation({
        id: 'l1',
        name: 'Rathaus',
        address: null,
        timeZone: 'Mars/Olympus',
        isActive: true,
        openingHours: STORED_PLAN,
      }).isErr(),
    ).toBe(true);
    expect(
      toLocation({
        id: 'l1',
        name: 'Rathaus',
        address: null,
        timeZone: 'Europe/Berlin',
        isActive: true,
        openingHours: {},
      }).isErr(),
    ).toBe(true);
  });
});
