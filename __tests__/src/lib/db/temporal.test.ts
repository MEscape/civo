import { Temporal } from 'temporal-polyfill';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { dateToInstant, instantToDate } from '@lib/db/temporal';

afterEach(() => vi.unstubAllGlobals());

describe('Prisma timestamp conversion', () => {
  const date = new Date('2026-10-10T08:30:00.123Z');

  it('preserves milliseconds when reading and writing', () => {
    const written = dateToInstant(date);
    expect(written).toBeInstanceOf(Temporal.Instant);
    expect(written.epochMilliseconds).toBe(date.getTime());
    expect(instantToDate(written)).toEqual(date);
  });

  it('still supplies an Instant when Node has no Temporal global', () => {
    vi.stubGlobal('Temporal', undefined);
    expect(dateToInstant(date)).toBeInstanceOf(Temporal.Instant);
  });

  it('refuses an invalid Date before reaching the database', () => {
    expect(() => dateToInstant(new Date('invalid'))).toThrow(RangeError);
  });
});
