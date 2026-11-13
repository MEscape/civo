import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createBookableResourceAction } from '@modules/booking/presentation/actions/create-bookable-resource-action';
import { updateBookableResourceAction } from '@modules/booking/presentation/actions/update-bookable-resource-action';
import {
  firstResourceStepWith,
  parseResourceStep,
} from '@modules/booking/presentation/forms/resource-steps';
import { todayBar } from '@modules/booking/presentation/forms/resource-today-bar';
import { resourceFormSchema } from '@modules/booking/presentation/schemas/resource-schema';

import { okAsync } from '@lib/result';

const mocks = vi.hoisted(() => ({ revalidatePath: vi.fn(), execute: vi.fn() }));

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@modules/booking/composition', () => {
  const useCase = { execute: mocks.execute };
  return {
    getBookingCommands: () => new Proxy({}, { get: () => useCase }),
    getBookingQueries: () => new Proxy({}, { get: () => useCase }),
  };
});

const week = Array.from({ length: 7 }, () => ({ intervals: [], breaks: [] }));
const fields = {
  name: 'Besprechungsraum 2',
  type: 'meeting-room',
  capacity: 4,
  setupMinutes: 0,
  teardownMinutes: 5,
  internalNote: '',
  followsLocation: true,
  openingHours: { weekly: week, exceptions: [] },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.execute.mockReturnValue(okAsync({ websiteId: 'site-1', id: 'r-1' }));
});

describe('the resource actions', () => {
  it('drops what a client may not name and refreshes the administration after a save', async () => {
    await createBookableResourceAction({
      websiteId: 'site-1',
      ...fields,
      locationId: 'loc-1',
      tenantId: 'someone-elses',
      skills: ['ausweise'],
      assignedActorId: 'actor-9',
    });

    expect(mocks.execute).toHaveBeenCalledWith({
      websiteId: 'site-1',
      ...fields,
      locationId: 'loc-1',
    });
    expect(mocks.revalidatePath).toHaveBeenCalled();
  });

  it('refuses a change without the version it was made from, before any use case runs', async () => {
    const result = await updateBookableResourceAction({
      websiteId: 'site-1',
      ...fields,
      resourceId: 'r-1',
      acknowledgeImpact: false,
    });

    expect(result.ok).toBe(false);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});

describe('the resource form schema', () => {
  it('puts the refusals of the rules on their fields', () => {
    const parsed = resourceFormSchema.safeParse({
      ...fields,
      capacity: 0,
      openingHours: { weekly: week, exceptions: [{ kind: 'closed', from: '2027-05-14', to: '' }] },
    });

    expect(parsed.success).toBe(false);
    const paths = parsed.error?.issues.map((issue) => [issue.path.join('.'), issue.message]);
    expect(paths).toEqual(
      expect.arrayContaining([
        ['capacity', 'booking.validation.capacity_invalid'],
        ['openingHours.exceptions.0.to', 'booking.validation.exception_invalid'],
      ]),
    );
  });
});

describe('the wizard of a resource', () => {
  it('reads its step from the address, the first one for anything else', () => {
    expect(parseResourceStep('availability')).toBe('availability');
    expect(parseResourceStep(['review', 'basics'])).toBe('review');
    expect(parseResourceStep('nope')).toBe('basics');
  });

  it('goes back to the first step that holds a refused field', () => {
    expect(firstResourceStepWith(['openingHours.exceptions.0.to', 'capacity'])).toBe('basics');
    expect(firstResourceStepWith(['followsLocation'])).toBe('availability');
    expect(firstResourceStepWith([])).toBeUndefined();
  });
});

describe('the bar of today', () => {
  const range = (start: string, end: string) => `${start.slice(11, 16)}–${end.slice(11, 16)}`;

  it('lays the stretches in use out on the opening hours, clipped to them', () => {
    const bar = todayBar(
      {
        timeZone: 'Europe/Berlin',
        window: { start: '2027-01-11T08:00:00+01:00', end: '2027-01-11T18:00:00+01:00' },
        busy: [
          { start: '2027-01-11T07:00:00+01:00', end: '2027-01-11T09:00:00+01:00', isFull: false },
          { start: '2027-01-11T13:00:00+01:00', end: '2027-01-11T15:30:00+01:00', isFull: true },
        ],
        peak: 2,
      },
      range,
    );

    expect(bar?.hours).toBe('08:00–18:00');
    expect(bar?.segments.map(({ left, width, isFull }) => [left, width, isFull])).toEqual([
      [0, 10, false],
      [50, 25, true],
    ]);
  });

  it('is nothing on a day the location is closed', () => {
    expect(
      todayBar({ timeZone: 'Europe/Berlin', window: null, busy: [], peak: 0 }, range),
    ).toBeNull();
  });
});
