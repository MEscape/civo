import { describe, expect, it } from 'vitest';

import { BOOKING_VALIDATION_CODES as CODES } from '@modules/booking/application/contracts/booking-constraints';
import type { LocationDto } from '@modules/booking/client';
import {
  newLocationValues,
  toFormValues,
} from '@modules/booking/presentation/forms/location-form-values';
import {
  locationInputSchema,
  pathOf,
  updateLocationSchema,
} from '@modules/booking/presentation/schemas/location-schema';

import { locationInput, officeWeek } from '../support/location-inputs';

/** The issues of a refused input as `path: message`, the shape the form puts under each field. */
function issues(schema: typeof locationInputSchema, input: unknown): string[] {
  const result = schema.safeParse(input);
  return result.success
    ? []
    : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).sort();
}

describe('the location form schema', () => {
  it('accepts what the create form starts with, once it has a name', () => {
    expect(issues(locationInputSchema, { ...newLocationValues(), name: 'Bürgerbüro' })).toEqual([]);
  });

  it('shows the message the server would, at the field the server would name', () => {
    const input = locationInput({
      name: '',
      openingHours: {
        weekly: officeWeek({
          0: { intervals: [{ start: '18:00', end: '08:00' }], breaks: [] },
          1: {
            intervals: [
              { start: '08:00', end: '12:00' },
              { start: '11:00', end: '14:00' },
            ],
            breaks: [{ start: '15:00', end: '16:00' }],
          },
        }),
        exceptions: [{ kind: 'closed', from: '2027-02-30', to: '2027-02-30' }],
      },
    });

    expect(issues(locationInputSchema, input)).toEqual([
      `name: ${CODES.nameInvalid}`,
      `openingHours.exceptions.0.from: ${CODES.exceptionInvalid}`,
      `openingHours.exceptions.0.to: ${CODES.exceptionInvalid}`,
      `openingHours.weekly.0.intervals.0.end: ${CODES.timeRangeInvalid}`,
      `openingHours.weekly.1.breaks.0.start: ${CODES.breakOutsideHours}`,
      `openingHours.weekly.1.intervals.1.start: ${CODES.timeRangesOverlap}`,
    ]);
  });

  it('refuses text that is too long before the rules read it', () => {
    expect(issues(locationInputSchema, locationInput({ name: 'x'.repeat(121) }))).toEqual([
      `name: ${CODES.nameInvalid}`,
    ]);
    expect(issues(locationInputSchema, locationInput({ address: 'x'.repeat(301) }))).toEqual([
      `address: ${CODES.addressInvalid}`,
    ]);
  });

  it('refuses a kind of exception that is not one, and drops what it does not know', () => {
    const input = {
      ...locationInput(),
      websiteId: 'someone-elses',
      openingHours: {
        weekly: officeWeek(),
        exceptions: [{ kind: 'holiday', from: '2027-01-01', to: '2027-01-01' }],
      },
    };

    expect(issues(locationInputSchema, input)).toEqual([
      `openingHours.exceptions.0.kind: ${CODES.exceptionInvalid}`,
    ]);
    const parsed = locationInputSchema.safeParse({
      ...locationInput(),
      websiteId: 'someone-elses',
    });
    expect(parsed.success && 'websiteId' in parsed.data).toBe(false);
  });

  it('asks an update for the location, the version it was made from, and the manager’s say', () => {
    const valid = {
      ...locationInput(),
      websiteId: 'site-1',
      locationId: 'loc-1',
      expectedVersion: '2027-01-10T11:00:00.000Z',
      acknowledgeImpact: false,
    };

    expect(issues(updateLocationSchema, valid)).toEqual([]);
    expect(issues(updateLocationSchema, { ...valid, expectedVersion: '' })).toEqual([
      `expectedVersion: ${CODES.idInvalid}`,
    ]);
    expect(issues(updateLocationSchema, { ...valid, acknowledgeImpact: 'yes' })).toEqual([
      `acknowledgeImpact: ${CODES.limitInvalid}`,
    ]);
    expect(issues(updateLocationSchema, { ...valid, locationId: '' })).toEqual([
      `locationId: ${CODES.idInvalid}`,
    ]);
  });
});

describe('the path of a refused field', () => {
  it('names list positions as numbers, the way the form library addresses them', () => {
    expect(pathOf('openingHours.weekly.0.intervals.12.end')).toEqual([
      'openingHours',
      'weekly',
      0,
      'intervals',
      12,
      'end',
    ]);
  });
});

describe('a location as the form edits it', () => {
  const view: LocationDto = {
    websiteId: 'site',
    id: 'loc-1',
    name: 'Bürgerbüro Mitte',
    address: null,
    timeZone: 'Europe/Berlin',
    isActive: false,
    weekly: officeWeek(),
    exceptions: [
      { kind: 'closed', from: '2027-01-01', to: '2027-01-01', day: null, holiday: 'newYear' },
      {
        kind: 'override',
        from: '2027-12-24',
        to: '2027-12-24',
        day: { intervals: [{ start: '08:00', end: '12:00' }], breaks: [] },
        holiday: null,
      },
    ],
    version: '2027-01-10T11:00:00.000Z',
    futureBookingCount: 0,
  };

  it('turns a missing address into an empty field and a closure into one without hours', () => {
    const values = toFormValues(view);

    expect(values.address).toBe('');
    expect(values.isActive).toBe(false);
    expect(values.openingHours.exceptions[0]).toEqual({
      kind: 'closed',
      from: '2027-01-01',
      to: '2027-01-01',
    });
    expect(values.openingHours.exceptions[1]?.day).toEqual(view.exceptions[1]?.day);
  });

  it('is valid as it comes, so opening a form and saving it unchanged is accepted', () => {
    expect(issues(locationInputSchema, toFormValues(view))).toEqual([]);
  });
});
