import { beforeEach, describe, expect, it, vi } from 'vitest';

import { queryLogger } from '@lib/db/query-logger';

import type { SqlMiddlewareContext } from '@prisma/orm-postgres/family-runtime';

const { debug, warn } = vi.hoisted(() => ({ debug: vi.fn(), warn: vi.fn() }));
vi.mock('@lib/logger', () => ({
  logger: { withContext: () => ({ debug, warn }) },
}));

const sql = 'SELECT * FROM "Booking" WHERE "id" = $1';

function context() {
  const states = new Map<symbol, Record<string, unknown>>();
  return {
    state: (key: symbol) => {
      let state = states.get(key);
      if (state === undefined) {
        state = {};
        states.set(key, state);
      }
      return state;
    },
  } as SqlMiddlewareContext;
}

beforeEach(() => {
  debug.mockClear();
  warn.mockClear();
});

describe('Prisma query logging through activity lifecycle hooks', () => {
  it.each(['succeeded', 'failed', 'stopped'] as const)(
    'records a query that %s without logging parameter values',
    async (outcome) => {
      const middleware = queryLogger();
      const ctx = context();
      await middleware.beforeEncode?.({ sql, params: ['private@example.org'] } as never, ctx);
      await middleware.activityEnded?.(
        { kind: 'statement' } as never,
        {
          kind: 'statement',
          returns: 'rows',
          rowCount: 3,
          latencyMs: 12.6,
          outcome,
          source: 'driver',
        },
        ctx,
      );
      expect(debug).toHaveBeenCalledWith('db.query', {
        sql,
        rowCount: 3,
        latencyMs: 13,
        completed: outcome === 'succeeded',
        source: 'driver',
      });
      expect(warn).toHaveBeenCalledTimes(outcome === 'succeeded' ? 0 : 1);
      expect(JSON.stringify([...debug.mock.calls, ...warn.mock.calls])).not.toContain(
        'private@example.org',
      );
    },
  );

  it.each(['succeeded', 'failed'] as const)('records a write that %s', async (outcome) => {
    const middleware = queryLogger();
    const ctx = context();
    await middleware.beforeEncode?.({ sql } as never, ctx);
    await middleware.activityEnded?.(
      { kind: 'statement' } as never,
      {
        kind: 'statement',
        returns: 'stats',
        stats: { affectedRows: 2 },
        latencyMs: 4,
        outcome,
        source: 'driver',
      },
      ctx,
    );
    expect(debug).toHaveBeenCalledWith('db.execute', {
      sql,
      affectedRows: outcome === 'succeeded' ? 2 : 0,
      latencyMs: 4,
      completed: outcome === 'succeeded',
      source: 'driver',
    });
    expect(warn).toHaveBeenCalledTimes(outcome === 'succeeded' ? 0 : 1);
  });

  it('ignores transaction completion rather than logging it as another statement', async () => {
    await queryLogger().activityEnded?.(
      { kind: 'transaction' } as never,
      { kind: 'transaction', outcome: 'succeeded' },
      context(),
    );
    expect(debug).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('records zero affected rows when a successful statement reports no statistics', async () => {
    const middleware = queryLogger();
    const ctx = context();
    await middleware.beforeEncode?.({ sql } as never, ctx);
    await middleware.activityEnded?.(
      { kind: 'statement' } as never,
      { kind: 'statement', returns: 'stats', latencyMs: 1, outcome: 'succeeded', source: 'driver' },
      ctx,
    );
    expect(debug).toHaveBeenCalledWith(
      'db.execute',
      expect.objectContaining({ affectedRows: 0, completed: true }),
    );
  });

  it('keeps SQL isolated between concurrent statement contexts', async () => {
    const middleware = queryLogger();
    const first = context();
    const second = context();
    await middleware.beforeEncode?.({ sql: 'SELECT 1' } as never, first);
    await middleware.beforeEncode?.({ sql: 'SELECT 2' } as never, second);
    const result = {
      kind: 'statement',
      returns: 'rows',
      rowCount: 1,
      latencyMs: 1,
      outcome: 'succeeded',
      source: 'driver',
    } as const;
    await middleware.activityEnded?.({ kind: 'statement' } as never, result, second);
    await middleware.activityEnded?.({ kind: 'statement' } as never, result, first);
    expect(debug.mock.calls.map(([, fields]) => fields.sql)).toEqual(['SELECT 2', 'SELECT 1']);
  });
});
