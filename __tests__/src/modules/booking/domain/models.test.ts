import { describe, expect, it } from 'vitest';

import { createAvailabilityPlan } from '@modules/booking/domain/models/availability-plan';
import type { AvailabilityPlanInput } from '@modules/booking/domain/models/availability-plan';
import { createBookableResourceDraft } from '@modules/booking/domain/models/bookable-resource';
import { createBookableServiceDraft } from '@modules/booking/domain/models/bookable-service';
import type { BookableServiceInput } from '@modules/booking/domain/models/bookable-service';
import { createBookingCustomer } from '@modules/booking/domain/models/booking-customer';
import { createBookingLocationDraft } from '@modules/booking/domain/models/booking-location';
import { parseBookingReference } from '@modules/booking/domain/models/booking-reference';

import { LOCATION_ID, WEBSITE, makeService } from '../support/fixtures';

const OPEN = { intervals: [{ start: '09:00', end: '17:00' }], breaks: [] };
const CLOSED = { intervals: [], breaks: [] };
const WEEK: AvailabilityPlanInput = {
  weekly: [OPEN, OPEN, OPEN, OPEN, OPEN, CLOSED, CLOSED],
  exceptions: [],
};

function serviceInput(overrides: Partial<BookableServiceInput> = {}): BookableServiceInput {
  return {
    websiteId: WEBSITE,
    name: 'Passport',
    description: null,
    category: 'citizen-services',
    isActive: true,
    durationMinutes: 30,
    preparationMinutes: 0,
    cleanupMinutes: 5,
    slotIntervalMinutes: 15,
    locationIds: [LOCATION_ID],
    requirements: [{ resourceType: 'employee', skills: ['passport'], count: 1, resourceIds: null }],
    participantsPerBooking: 1,
    participantsPerSession: 1,
    noticeMinutes: 60,
    horizonDays: 30,
    availability: null,
    cancellation: { isAllowed: true, deadlineMinutes: 1440, allowedActors: ['customer', 'staff'] },
    rescheduling: { isAllowed: true, deadlineMinutes: 1440, allowedActors: ['customer', 'staff'] },
    information: [{ field: 'email', isRequired: true }],
    requiredDocuments: ['id-card'],
    instructions: null,
    ...overrides,
  };
}

function fieldsOf(result: { isErr(): boolean; error?: unknown }): string[] {
  const error = (result as { error: { fieldErrors: Record<string, string[]> } }).error;
  return Object.keys(error.fieldErrors);
}

describe('availability plan', () => {
  it('accepts a valid week', () => {
    expect(createAvailabilityPlan(WEEK).isOk()).toBe(true);
  });

  it('needs seven days', () => {
    expect(createAvailabilityPlan({ weekly: [OPEN], exceptions: [] }).isErr()).toBe(true);
  });

  it('rejects reversed, overlapping and malformed ranges with the path of the problem', () => {
    const bad = createAvailabilityPlan({
      weekly: [
        { intervals: [{ start: '12:00', end: '09:00' }], breaks: [] },
        {
          intervals: [
            { start: '09:00', end: '12:00' },
            { start: '11:00', end: '13:00' },
          ],
          breaks: [],
        },
        { intervals: [{ start: '9am', end: '12:00' }], breaks: [] },
        CLOSED,
        CLOSED,
        CLOSED,
        CLOSED,
      ],
      exceptions: [],
    });
    expect(bad.isErr()).toBe(true);
    const fields = fieldsOf(bad);
    expect(fields.some((field) => field.startsWith('availability.weekly.0'))).toBe(true);
    expect(fields.some((field) => field.startsWith('availability.weekly.1'))).toBe(true);
    expect(fields.some((field) => field.startsWith('availability.weekly.2'))).toBe(true);
  });

  it('rejects exceptions with impossible dates or unknown kinds', () => {
    const result = createAvailabilityPlan({
      ...WEEK,
      exceptions: [
        { kind: 'closed', from: '2027-02-30', to: '2027-03-01' },
        { kind: 'maybe', from: '2027-03-01', to: '2027-03-01' },
        { kind: 'closed', from: '2027-03-05', to: '2027-03-01' },
        { kind: 'override', from: '2027-03-01', to: '2027-03-01' },
      ],
    });
    expect(result.isErr()).toBe(true);
    expect(fieldsOf(result)).toHaveLength(4);
  });
});

describe('service', () => {
  it('builds a draft from valid input', () => {
    const result = createBookableServiceDraft(serviceInput());
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toMatchObject({
      durationMinutes: 30,
      category: 'citizen-services',
    });
  });

  it('collects every problem in one pass', () => {
    const result = createBookableServiceDraft(
      serviceInput({
        name: '  ',
        durationMinutes: 0,
        slotIntervalMinutes: 0,
        horizonDays: 0,
        locationIds: [],
        requirements: [],
        participantsPerBooking: 5,
        participantsPerSession: 2,
      }),
    );
    const fields = fieldsOf(result);
    for (const field of [
      'name',
      'durationMinutes',
      'slotIntervalMinutes',
      'horizonDays',
      'locationIds',
      'requirements',
      'participantsPerSession',
    ]) {
      expect(fields).toContain(field);
    }
  });

  it('rejects an unknown information field and an invalid skill key', () => {
    const result = createBookableServiceDraft(
      serviceInput({
        information: [{ field: 'shoe-size', isRequired: true }],
        requirements: [
          { resourceType: 'employee', skills: ['Not A Key'], count: 1, resourceIds: null },
        ],
      }),
    );
    expect(result.isErr()).toBe(true);
  });

  it('always asks for the e-mail address', () => {
    const result = createBookableServiceDraft(serviceInput({ information: [] }));
    expect(
      result.isErr() || result._unsafeUnwrap().information.some((i) => i.field === 'email'),
    ).toBe(true);
  });
});

describe('resource and location', () => {
  it('validates a resource', () => {
    const ok = createBookableResourceDraft({
      websiteId: WEBSITE,
      locationId: LOCATION_ID,
      name: 'Anna',
      type: 'employee',
      skills: ['passport'],
      capacity: null,
      availability: WEEK,
      isActive: true,
    });
    expect(ok.isOk()).toBe(true);
    const bad = createBookableResourceDraft({
      websiteId: WEBSITE,
      locationId: null,
      name: '',
      type: 'spaceship',
      skills: [],
      capacity: 0,
      availability: null,
      isActive: true,
    });
    expect(fieldsOf(bad)).toEqual(expect.arrayContaining(['name', 'type', 'capacity']));
  });

  it('validates a location and its time zone', () => {
    const base = {
      websiteId: WEBSITE,
      name: 'Town hall',
      address: null,
      openingHours: WEEK,
      isActive: true,
    };
    expect(createBookingLocationDraft({ ...base, timeZone: 'Europe/Berlin' }).isOk()).toBe(true);
    expect(fieldsOf(createBookingLocationDraft({ ...base, timeZone: 'Mars/Base' }))).toContain(
      'timeZone',
    );
  });
});

describe('customer', () => {
  const service = makeService({
    information: [
      { field: 'email', isRequired: true },
      { field: 'firstName', isRequired: true },
      { field: 'phone', isRequired: false },
    ],
  });

  it('normalises the e-mail address and keeps only what the service asks for', () => {
    const customer = createBookingCustomer(service, {
      email: ' Anna@Example.COM ',
      firstName: 'Anna',
      notes: 'should be dropped',
      lastName: 'dropped too',
    })._unsafeUnwrap();
    expect(customer.email).toBe('anna@example.com');
    expect(customer.notes).toBeNull();
    expect(customer.lastName).toBeNull();
    expect(customer.phone).toBeNull();
  });

  it('requires required fields and a valid e-mail', () => {
    const result = createBookingCustomer(service, { email: 'not-an-email' });
    expect(fieldsOf(result)).toEqual(expect.arrayContaining(['email', 'firstName']));
  });

  it('bounds field length', () => {
    const result = createBookingCustomer(service, { email: 'a@b.de', firstName: 'x'.repeat(500) });
    expect(fieldsOf(result)).toContain('firstName');
  });
});

describe('booking reference', () => {
  it('accepts a code regardless of case and spacing', () => {
    expect(parseBookingReference(' 7kq3m9xd2p ')._unsafeUnwrap()).toBe('7KQ3M9XD2P');
  });

  it('rejects ambiguous characters and wrong lengths', () => {
    expect(parseBookingReference('7KQ3M9XD2I').isErr()).toBe(true);
    expect(parseBookingReference('7KQ3').isErr()).toBe(true);
    expect(parseBookingReference('').isErr()).toBe(true);
  });
});
