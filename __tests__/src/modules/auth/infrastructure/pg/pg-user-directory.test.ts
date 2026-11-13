import { Pool } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { toActorId } from '@modules/auth/domain/models/ids';
import { PgUserDirectory } from '@modules/auth/infrastructure/pg/pg-user-directory';

import type { QueryResult } from 'pg';

const error = vi.hoisted(() => vi.fn());
vi.mock('@lib/logger', () => ({ logger: { withContext: () => ({ error }) } }));

const page = { page: 20, pageSize: 2 };
const request = { ids: null, text: null, sort: { field: 'name', direction: 'asc' } as const, page };

function world(rows: ReadonlyArray<Record<string, unknown>>) {
  const query = vi
    .fn<(text: string, values: unknown[]) => Promise<QueryResult<Record<string, unknown>>>>()
    .mockResolvedValue({
      rows: [...rows],
      command: 'SELECT',
      rowCount: rows.length,
      oid: 0,
      fields: [],
    });
  // Only the Promise query overload is exercised; no connection is opened by constructing the pool.
  const pool = Object.assign(new Pool(), { query });
  return { directory: new PgUserDirectory(() => pool), query };
}

describe('PgUserDirectory', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reports driver failures once while preserving the cause without logging account data', async () => {
    const { directory, query } = world([]);
    const cause = new Error('database failed for victim@example.org token=SECRET');
    query.mockRejectedValueOnce(cause);

    const result = await directory.findByEmail('victim@example.org');
    expect(result._unsafeUnwrapErr().cause).toBe(cause);
    expect(error).toHaveBeenCalledExactlyOnceWith('auth.directory_failed', {
      kind: 'infrastructure',
      code: 'auth.directory_failed',
    });
    expect(JSON.stringify(error.mock.calls)).not.toMatch(/victim|SECRET/);
  });
  it('fails closed when legacy accounts share a case-insensitive address', async () => {
    const { directory } = world([
      { id: 'first', email: 'ADA@example.org' },
      { id: 'second', email: 'ada@example.org' },
    ]);
    expect((await directory.findByEmail('ada@example.org'))._unsafeUnwrapErr().code).toBe(
      'auth.directory_failed',
    );
  });

  it('retains the matching total when the requested page has no rows', async () => {
    const { directory } = world([
      {
        id: null,
        name: null,
        email: null,
        emailVerified: null,
        createdAt: null,
        total: '3',
      },
    ]);
    const found = (await directory.search(request))._unsafeUnwrap();
    expect(found).toEqual({ items: [], total: 3, page: 20, pageSize: 2, pageCount: 2 });
  });

  it('maps identity fields without exposing persistence counts', async () => {
    const user = {
      id: toActorId('person'),
      email: 'person@example.org',
      name: 'Person',
      emailVerified: true,
      createdAt: new Date('2026-10-01T00:00:00Z'),
    };
    const { directory } = world([{ ...user, total: '1' }]);
    const found = (
      await directory.search({ ...request, page: { page: 1, pageSize: 2 } })
    )._unsafeUnwrap();
    expect(found.items).toEqual([{ ...user, image: null }]);
    expect(found.total).toBe(1);
  });

  it('does not query when a tenant roster contains no users', async () => {
    const { directory, query } = world([]);
    const found = (await directory.search({ ...request, ids: [] }))._unsafeUnwrap();
    expect(found.total).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });

  it('includes the stored avatar in searches and email lookups', async () => {
    const user = {
      id: 'person',
      email: 'person@example.org',
      name: 'Person',
      emailVerified: true,
      createdAt: new Date(),
      image: '/api/profile/avatar/person/photo.webp',
    };
    const { directory, query } = world([{ ...user, total: '1' }]);
    expect((await directory.search(request))._unsafeUnwrap().items[0]?.image).toBe(user.image);
    expect((await directory.findByEmail(user.email))._unsafeUnwrap()?.image).toBe(user.image);
    expect(query.mock.calls.every(([sql]) => sql.includes('image'))).toBe(true);
  });

  it('propagates database failures instead of reporting an empty list', async () => {
    const cause = new Error('database unavailable');
    const { directory, query } = world([]);
    query.mockRejectedValueOnce(cause);
    const result = await directory.search(request);
    expect(result._unsafeUnwrapErr()).toMatchObject({
      kind: 'infrastructure',
      code: 'auth.directory_failed',
      cause,
    });
  });

  it('keeps supplied identifiers and search text in bound parameters', async () => {
    const { directory, query } = world([]);
    const id = toActorId('user-1');
    await directory.search({ ...request, ids: [id], text: '100%_\\' });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('LEFT JOIN LATERAL'), [
      [id],
      '%100\\%\\_\\\\%',
      2,
      38,
    ]);
  });
});
