import { SqlQueryError } from '@prisma/orm-family-sql/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { toTenantId } from '@modules/auth/domain/models/ids';
import { MAX_DATASETS_PER_SOURCE } from '@modules/data-sources/application/data-sources-limits';
import { toDataSourceId } from '@modules/data-sources/domain/models/ids';
import { deleteSourceWithDatasets } from '@modules/data-sources/infrastructure/transactions/delete-source-with-datasets';

import type * as LibDb from '@lib/db';
import { conflictError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

const state = vi.hoisted(() => ({
  ids: ['d1'],
  lockedIds: ['d1'],
  events: [] as string[],
  transientFailures: 0,
}));

vi.mock('@lib/db', async (original) => {
  const actual = await original<typeof LibDb>();
  function datasets(locked: boolean) {
    let limit = Infinity;
    const query = {
      where: () => query,
      select: () => query,
      orderBy: () => query,
      limit: (count: number) => {
        limit = count;
        return query;
      },
      all: async () => (locked ? state.lockedIds : state.ids).slice(0, limit).map((id) => ({ id })),
    };
    return query;
  }
  const sources = {
    where: () => sources,
    select: () => sources,
    first: async () => ({ websiteId: 'website-1' }),
    deleteAndCount: async () => {
      state.events.push('delete');
      return 1;
    },
  };
  const tx = { orm: { public: { DataSource: sources, Dataset: datasets(true) } } };
  return {
    ...actual,
    db: {
      orm: { public: { DataSource: sources, Dataset: datasets(false) } },
      transaction: async (run: (handle: typeof tx) => Promise<unknown>) => {
        state.events.push('begin');
        if (state.transientFailures > 0) {
          state.transientFailures -= 1;
          throw new SqlQueryError('serialization failure', { sqlState: '40001' });
        }
        const result = await run(tx);
        state.events.push('end');
        return result;
      },
    },
    advisoryLock: async (_handle: unknown, key: string) => {
      state.events.push(`lock:${key}`);
    },
  };
});

beforeEach(() => {
  state.ids = ['d1'];
  state.lockedIds = ['d1'];
  state.events = [];
  state.transientFailures = 0;
});

const target = { id: toDataSourceId('source-1'), tenantId: toTenantId('website-1') };

describe('safe source cascade', () => {
  it('guards raw stored child ids, before reserving a transaction connection', async () => {
    state.ids = ['d1', 'unknown-canonical-kind'];
    state.lockedIds = [...state.ids];
    const guard = vi.fn((scope) => {
      state.events.push('guard');
      expect(scope.datasetIds).toEqual(state.ids);
      return okAsync(undefined);
    });
    expect((await deleteSourceWithDatasets({ ...target, guard }))._unsafeUnwrap()).toEqual(
      state.ids,
    );
    expect(state.events).toEqual(['guard', 'begin', 'lock:data-source:source-1', 'delete', 'end']);
  });

  it('refuses an overflow without calling the guard or cascading', async () => {
    state.ids = Array.from({ length: MAX_DATASETS_PER_SOURCE + 1 }, (_, index) => `d${index}`);
    const guard = vi.fn(() => okAsync(undefined));
    expect((await deleteSourceWithDatasets({ ...target, guard }))._unsafeUnwrapErr().code).toBe(
      'data_source.deletion_incomplete',
    );
    expect(guard).not.toHaveBeenCalled();
    expect(state.events).toEqual([]);
  });

  it('refuses a child added between the usage check and the locked deletion', async () => {
    const guard = () => {
      state.lockedIds.push('late-child');
      return okAsync(undefined);
    };
    expect((await deleteSourceWithDatasets({ ...target, guard }))._unsafeUnwrapErr().kind).toBe(
      'conflict',
    );
    expect(state.events).not.toContain('delete');
  });

  it('keeps data when a neighbour refuses deletion', async () => {
    const result = await deleteSourceWithDatasets({
      ...target,
      guard: () => errAsync(conflictError('dataset.in_use', 'Used.')),
    });
    expect(result._unsafeUnwrapErr().code).toBe('dataset.in_use');
    expect(state.events).toEqual([]);
  });

  it('retries only the transaction after a serialization failure, without repeating neighbour work', async () => {
    state.transientFailures = 1;
    const guard = vi.fn(() => okAsync(undefined));
    expect((await deleteSourceWithDatasets({ ...target, guard })).isOk()).toBe(true);
    expect(guard).toHaveBeenCalledTimes(1);
    expect(state.events.filter((event) => event === 'begin')).toHaveLength(2);
    expect(state.events.filter((event) => event === 'delete')).toHaveLength(1);
  });
});
