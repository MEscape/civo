import { describe, expect, it, vi } from 'vitest';

vi.mock('@lib/config/server', () => ({
  serverEnv: {
    DATABASE_URL: 'postgresql://user:password@localhost:5432/mydb',
    DATABASE_POOL_SIZE: 5,
    DATABASE_POOL_TIMEOUT_SECONDS: 10,
    NODE_ENV: 'test',
  },
}));
vi.mock('@prisma/orm-postgres/runtime', () => ({ default: vi.fn(() => ({ close: vi.fn() })) }));
vi.mock('@lib/db/query-logger', () => ({ queryLogger: vi.fn() }));
vi.mock('@lib/logger', () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn() })) },
}));

/**
 * Prisma 8's `timestamptz` codec reads and writes through the global
 * `Temporal`; Node 24 (the pinned runtime) has none, so website creation
 * failed with "this runtime has no global Temporal implementation".
 */
describe('Temporal runtime for the Prisma timestamp codec', () => {
  it('is available once the database client module is loaded', async () => {
    const { dateToInstant, instantToDate } = await import('@lib/db');

    expect(Reflect.get(globalThis, 'Temporal')).toBeDefined();

    const written = dateToInstant(new Date('2026-10-10T08:30:00.123Z'));
    expect(typeof written).toBe('object');
    expect(instantToDate(written as { epochMilliseconds: number })).toEqual(
      new Date('2026-10-10T08:30:00.123Z'),
    );
  });
});
