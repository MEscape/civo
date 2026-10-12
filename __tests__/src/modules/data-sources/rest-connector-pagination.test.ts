import { describe, expect, it } from 'vitest';

import { toTenantId } from '@modules/auth';
import { toDataSourceId } from '@modules/data-sources/domain/models/ids';
import { RestJsonConnector } from '@modules/data-sources/infrastructure/connector/rest-json-connector';
import type { RestTarget } from '@modules/data-sources/infrastructure/connector/rest-json-connector';

import { okAsync } from '@lib/result';

const BASE = 'https://api.example.org/v1/events';

const TARGET_IDS = {
  tenantId: toTenantId('00000000000000000000000000000001'),
  dataSourceId: toDataSourceId('00000000000000000000000000000002'),
} as const;

interface Call {
  readonly url: string;
  readonly method: string;
  readonly body: unknown;
}

function addressOf(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') {
    return input;
  }
  return input instanceof URL ? input.href : input.url;
}

/** An API answering from `answers` in order, recording what it was asked. */
function fakeApi(answers: readonly unknown[]) {
  const calls: Call[] = [];
  const connector = new RestJsonConnector({
    credentials: { resolve: () => okAsync({ mode: 'NONE' as const }) },
    resolveHost: () => Promise.resolve(['93.184.216.34']),
    fetchImplementation: (input, init) => {
      const answer = answers[calls.length];
      calls.push({
        url: addressOf(input),
        method: init?.method ?? 'GET',
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
      });
      return Promise.resolve(
        new Response(JSON.stringify(answer ?? []), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    },
  });
  return { calls, connector };
}

function target(config: Record<string, unknown>): RestTarget {
  return {
    ...TARGET_IDS,
    rawConfig: { baseUrl: BASE, path: '/', authMode: 'NONE', ...config },
  };
}

const rows = (from: number, count: number) =>
  Array.from({ length: count }, (_, index) => ({ id: from + index }));

describe('RestJsonConnector without pagination', () => {
  it('answers the list of an envelope in one request', async () => {
    const { calls, connector } = fakeApi([{ data: rows(0, 3) }]);

    const body = await connector.fetchRestBody({
      target: target({}),
      window: { limit: 1_000, offset: 0 },
    });

    expect(body._unsafeUnwrap()).toEqual(rows(0, 3));
    expect(calls).toHaveLength(1);
  });

  it('answers just the list at an explicit records path', async () => {
    const { connector } = fakeApi([{ payload: { rows: rows(0, 2) }, total: 2 }]);

    const body = await connector.fetchRestBody({
      target: target({ recordsPath: 'payload.rows' }),
      window: { limit: 10, offset: 0 },
    });

    expect(body._unsafeUnwrap()).toEqual(rows(0, 2));
  });

  it('fails when the records path leads nowhere', async () => {
    const { connector } = fakeApi([{ other: [] }]);

    const body = await connector.fetchRestBody({
      target: target({ recordsPath: 'payload.rows' }),
      window: { limit: 10, offset: 0 },
    });

    expect(body._unsafeUnwrap).toThrow();
    expect(body.isErr() && body.error.code).toBe('data_source.records_not_found');
  });
});

describe('RestJsonConnector with pagination', () => {
  const offset = {
    pagination: { kind: 'offset', limitParam: 'limit', offsetParam: 'offset', pageSize: 2 },
  };

  it('reads pages until the records wanted are in', async () => {
    const { calls, connector } = fakeApi([rows(0, 2), rows(2, 2), rows(4, 2)]);

    const body = await connector.fetchRestBody({
      target: target(offset),
      window: { limit: 3, offset: 0 },
    });

    expect(body._unsafeUnwrap()).toEqual(rows(0, 4));
    expect(calls.map((call) => new URL(call.url).search)).toEqual([
      '?limit=2&offset=0',
      '?limit=2&offset=2',
    ]);
  });

  it('stops at the first short page', async () => {
    const { calls, connector } = fakeApi([rows(0, 2), rows(2, 1), rows(3, 2)]);

    const body = await connector.fetchRestBody({
      target: target(offset),
      window: { limit: 1_000, offset: 0 },
    });

    expect(body._unsafeUnwrap()).toEqual(rows(0, 3));
    expect(calls).toHaveLength(2);
  });

  it('never reads more pages than the limit, however much is wanted', async () => {
    const { calls, connector } = fakeApi(
      Array.from({ length: 30 }, (_, page) => rows(page * 2, 2)),
    );

    await connector.fetchRestBody({ target: target(offset), window: { limit: 1_000, offset: 0 } });

    expect(calls).toHaveLength(10);
  });

  it('finds the list of each page inside its envelope', async () => {
    const { connector } = fakeApi([{ data: rows(0, 2) }, { data: rows(2, 1) }]);

    const body = await connector.fetchRestBody({
      target: target(offset),
      window: { limit: 1_000, offset: 0 },
    });

    expect(body._unsafeUnwrap()).toEqual(rows(0, 3));
  });

  it('follows a cursor and stops when the answer has none', async () => {
    const { calls, connector } = fakeApi([
      { items: rows(0, 2), meta: { next: 'c2' } },
      { items: rows(2, 2), meta: { next: 'c3' } },
      { items: rows(4, 1), meta: { next: null } },
    ]);
    const cursor = {
      pagination: {
        kind: 'cursor',
        cursorParam: 'after',
        nextCursorPath: 'meta.next',
        pageSize: 2,
      },
    };

    const body = await connector.fetchRestBody({
      target: target(cursor),
      window: { limit: 1_000, offset: 0 },
    });

    expect(body._unsafeUnwrap()).toEqual(rows(0, 5));
    expect(calls.map((call) => new URL(call.url).searchParams.get('after'))).toEqual([
      null,
      'c2',
      'c3',
    ]);
  });

  it('does not loop on a cursor the API keeps returning', async () => {
    const page = { items: rows(0, 2), meta: { next: 'same' } };
    const { calls, connector } = fakeApi([page, page, page, page]);
    const cursor = {
      pagination: {
        kind: 'cursor',
        cursorParam: 'after',
        nextCursorPath: 'meta.next',
        pageSize: 2,
      },
    };

    await connector.fetchRestBody({ target: target(cursor), window: { limit: 1_000, offset: 0 } });

    expect(calls).toHaveLength(2);
  });

  it('follows next links and keeps them on the configured origin', async () => {
    const { calls, connector } = fakeApi([
      { data: rows(0, 2), links: { next: '/v1/events?page=2' } },
      { data: rows(2, 2), links: { next: 'https://evil.example.net/steal' } },
    ]);
    const link = { pagination: { kind: 'next-url', nextUrlPath: 'links.next' } };

    const body = await connector.fetchRestBody({
      target: target(link),
      window: { limit: 1_000, offset: 0 },
    });

    expect(body.isErr() && body.error.code).toBe('data_source.address_not_allowed');
    expect(calls.map((call) => call.url)).toEqual([BASE, `${BASE}?page=2`]);
  });

  it('sends pagination parameters in the JSON body of a POST source', async () => {
    const { calls, connector } = fakeApi([rows(0, 2), rows(2, 1)]);
    const post = {
      method: 'POST',
      requestBody: { filter: 'open' },
      pagination: {
        kind: 'page',
        pageParam: 'paging.page',
        sizeParam: 'paging.size',
        placement: 'body',
        pageSize: 2,
      },
    };

    await connector.fetchRestBody({ target: target(post), window: { limit: 1_000, offset: 0 } });

    expect(calls.map((call) => [call.method, call.url, call.body])).toEqual([
      ['POST', BASE, { filter: 'open', paging: { page: 1, size: 2 } }],
      ['POST', BASE, { filter: 'open', paging: { page: 2, size: 2 } }],
    ]);
  });

  it('fails the whole read when an API answers no list', async () => {
    const { connector } = fakeApi([{ message: 'maintenance' }]);

    const body = await connector.fetchRestBody({
      target: target(offset),
      window: { limit: 10, offset: 0 },
    });

    expect(body.isErr() && body.error.code).toBe('data_source.records_not_found');
  });
});
