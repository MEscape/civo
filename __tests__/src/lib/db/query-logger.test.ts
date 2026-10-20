import { beforeEach, describe, expect, it, vi } from 'vitest';

import { queryLogger } from '@lib/db/query-logger';

const { mockDebug, mockWarn } = vi.hoisted(() => ({ mockDebug: vi.fn(), mockWarn: vi.fn() }));
vi.mock('@lib/logger', () => ({
  logger: { withContext: vi.fn(() => ({ debug: mockDebug, warn: mockWarn })) },
}));

const plan = { sql: 'SELECT * FROM "Booking" WHERE "id" = $1', params: ['jane.doe@example.org'] };
// The runtime's own types are wider than what the middleware reads.
const asPlan = plan as never;

beforeEach(() => {
  mockDebug.mockClear();
  mockWarn.mockClear();
});

describe('queryLogger', () => {
  const middleware = queryLogger();

  it('is a SQL-family middleware with a stable name', () => {
    expect(middleware).toMatchObject({ name: 'query-logger', familyId: 'sql' });
  });

  it('logs a completed query at debug, with SQL text and timing', async () => {
    await middleware.afterQuery?.(
      asPlan,
      { rowCount: 3, latencyMs: 12.6, completed: true, source: 'driver' } as never,
      {} as never,
    );

    expect(mockDebug).toHaveBeenCalledWith('db.query', {
      sql: plan.sql,
      rowCount: 3,
      latencyMs: 13,
      completed: true,
      source: 'driver',
    });
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('also warns about a query that did not complete', async () => {
    await middleware.afterQuery?.(
      asPlan,
      { rowCount: 0, latencyMs: 1, completed: false, source: 'driver' } as never,
      {} as never,
    );

    expect(mockWarn).toHaveBeenCalledWith(
      'db.query.failed',
      expect.objectContaining({ completed: false }),
    );
  });

  it('logs a completed write at debug, with the rows it touched', async () => {
    await middleware.afterExecute?.(
      asPlan,
      { stats: { affectedRows: 2 }, latencyMs: 4, completed: true, source: 'driver' } as never,
      {} as never,
    );

    expect(mockDebug).toHaveBeenCalledWith('db.execute', {
      sql: plan.sql,
      affectedRows: 2,
      latencyMs: 4,
      completed: true,
      source: 'driver',
    });
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('warns about a write that did not complete, with no rows touched', async () => {
    await middleware.afterExecute?.(
      asPlan,
      { latencyMs: 4, completed: false, source: 'driver' } as never,
      {} as never,
    );

    expect(mockWarn).toHaveBeenCalledWith(
      'db.execute.failed',
      expect.objectContaining({ affectedRows: 0, completed: false }),
    );
  });

  it('never logs the bound parameter values, which may be personal data', async () => {
    await middleware.afterQuery?.(
      asPlan,
      { rowCount: 1, latencyMs: 1, completed: false, source: 'driver' } as never,
      {} as never,
    );

    expect(JSON.stringify([...mockDebug.mock.calls, ...mockWarn.mock.calls])).not.toContain(
      'jane.doe',
    );
  });
});
