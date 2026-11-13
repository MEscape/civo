import { describe, expect, it } from 'vitest';

import type { LocationInput } from '@modules/booking/application/contracts/location-inputs';
import { parseLocationInput } from '@modules/booking/application/services/parse-location-input';
import {
  readAvailability,
  writeAvailability,
} from '@modules/booking/infrastructure/prisma/availability-record-mapper';
import {
  toLocationColumns,
  toStoredLocation,
} from '@modules/booking/infrastructure/prisma/location-admin-record-mapper';

import { locationInput, officeDay, officeWeek } from '../support/location-inputs';

function parsed(input: LocationInput) {
  const result = parseLocationInput(input);
  if (result.isErr()) {
    throw new Error('the fixture is invalid');
  }
  return result.value;
}

const WITH_EXCEPTIONS = locationInput({
  openingHours: {
    weekly: officeWeek({ 5: { intervals: [{ start: '10:00', end: '24:00' }], breaks: [] } }),
    exceptions: [
      { kind: 'closed', from: '2027-01-01', to: '2027-01-01' },
      {
        kind: 'override',
        from: '2027-12-24',
        to: '2027-12-24',
        day: { intervals: [{ start: '08:00', end: '12:00' }], breaks: [] },
      },
      { kind: 'additional', from: '2027-05-01', to: '2027-05-02', day: officeDay() },
    ],
  },
});

describe('the stored shape of opening hours', () => {
  it('reads back exactly what it wrote: the week, the breaks, midnight, every kind of exception', () => {
    const { openingHours } = parsed(WITH_EXCEPTIONS);

    const read = readAvailability(JSON.parse(JSON.stringify(writeAvailability(openingHours))));

    expect(read.isOk() && read.value).toEqual(openingHours);
  });

  it('writes the week Monday first as HH:mm text, and a closure without hours', () => {
    const stored = writeAvailability(parsed(WITH_EXCEPTIONS).openingHours);

    expect(stored.weekly).toHaveLength(7);
    expect(stored.weekly[0]).toEqual({
      intervals: [{ start: '08:00', end: '18:00' }],
      breaks: [{ start: '12:00', end: '13:00' }],
    });
    expect(stored.weekly[5]).toEqual({ intervals: [{ start: '10:00', end: '24:00' }], breaks: [] });
    expect(stored.exceptions[0]).toEqual({ kind: 'closed', from: '2027-01-01', to: '2027-01-01' });
    expect(stored.exceptions[1]).toMatchObject({
      kind: 'additional',
      from: '2027-05-01',
      to: '2027-05-02',
    });
  });
});

describe('a location as a row', () => {
  const record = (overrides: Record<string, unknown> = {}) => ({
    id: 'loc-1',
    name: 'Bürgerbüro Mitte',
    address: null,
    timeZone: 'Europe/Berlin',
    isActive: true,
    openingHours: JSON.parse(
      JSON.stringify(writeAvailability(parsed(locationInput()).openingHours)),
    ),
    updatedAt: { epochMilliseconds: Date.parse('2027-01-10T11:00:00.123Z') },
    ...overrides,
  });

  it('is read into the rules own types, with the version as a moment', () => {
    const result = toStoredLocation(record());

    expect(result.isOk() && result.value).toMatchObject({
      id: 'loc-1',
      name: 'Bürgerbüro Mitte',
      address: null,
      zone: 'Europe/Berlin',
      isActive: true,
      updatedAt: Date.parse('2027-01-10T11:00:00.123Z'),
    });
  });

  it.each([
    ['a time zone it does not know', { timeZone: 'Mars/Base' }],
    ['hours that are not in the stored shape', { openingHours: { weekly: [] } }],
    ['hours that are not an object at all', { openingHours: 'always' }],
  ])('is a persistence failure, not a half-built location, for %s', (_name, overrides) => {
    const result = toStoredLocation(record(overrides));

    expect(result.isErr() && result.error.kind).toBe('infrastructure');
  });

  it('turns what the rules hold into the columns of a write', () => {
    const columns = toLocationColumns({ ...parsed(locationInput({ address: '' })) });

    expect(columns).toMatchObject({
      name: 'Bürgerbüro Mitte',
      address: null,
      timeZone: 'Europe/Berlin',
      isActive: true,
    });
    expect(columns.openingHours).toEqual(
      JSON.parse(JSON.stringify(writeAvailability(parsed(locationInput()).openingHours))),
    );
  });
});
