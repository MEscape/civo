import { afterEach, describe, expect, it, vi } from 'vitest';

import { dateToInstant, instantToDate } from '@lib/db/temporal';

/** `Temporal.Instant` is a class with a static `from`. */
const instantClass = (from: (iso: string) => unknown) => Object.assign(class Instant {}, { from });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('instantToDate', () => {
  it('reads the epoch milliseconds of a Temporal.Instant as a Date', () => {
    expect(instantToDate({ epochMilliseconds: 1_767_225_600_123 })).toEqual(
      new Date('2026-01-01T00:00:00.123Z'),
    );
  });
});

describe('dateToInstant', () => {
  const date = new Date('2026-10-10T08:30:00.123Z');

  it('builds a Temporal.Instant when the runtime has the global', () => {
    const from = vi.fn((iso: string) => ({ epochMilliseconds: Date.parse(iso) }));
    vi.stubGlobal('Temporal', { Instant: instantClass(from) });

    const written = dateToInstant(date);

    expect(from).toHaveBeenCalledWith('2026-10-10T08:30:00.123Z');
    expect(written).toEqual({ epochMilliseconds: date.getTime() });
  });

  it.each([
    ['no Temporal global', undefined],
    ['a Temporal that is not an object', 'nope'],
    ['a Temporal without Instant', {}],
    ['an Instant that is not a function', { Instant: {} }],
    ['an Instant without from', { Instant() {} }],
  ])('falls back to ISO-8601 text with %s', (_name, temporal) => {
    vi.stubGlobal('Temporal', temporal);

    expect(dateToInstant(date)).toBe('2026-10-10T08:30:00.123Z');
  });

  it('falls back to ISO-8601 text when from does not answer an object', () => {
    vi.stubGlobal('Temporal', { Instant: instantClass(() => 'not an object') });

    expect(dateToInstant(date)).toBe('2026-10-10T08:30:00.123Z');
  });

  it('falls back to ISO-8601 text when from answers null', () => {
    vi.stubGlobal('Temporal', { Instant: instantClass(() => null) });

    expect(dateToInstant(date)).toBe('2026-10-10T08:30:00.123Z');
  });
});
