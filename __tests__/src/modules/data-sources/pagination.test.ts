import { describe, expect, it } from 'vitest';

import { parseRestConnectionConfig } from '@modules/data-sources/domain/config/rest-connection-config';
import { discoverFromBody } from '@modules/data-sources/domain/discovery/discovery';
import { mapRecords, toRecordList } from '@modules/data-sources/domain/mapping/mapped-record';
import { buildRequest } from '@modules/data-sources/domain/pagination/build-request';
import {
  firstPageRequest,
  nextPageRequest,
} from '@modules/data-sources/domain/pagination/pagination-strategy';
import type {
  PageProgress,
  PaginationStrategy,
} from '@modules/data-sources/domain/pagination/pagination-strategy';
import {
  READ_WINDOW_LIMITS,
  createReadWindow,
  firstRecords,
} from '@modules/data-sources/domain/pagination/read-window';
import { locateRecords } from '@modules/data-sources/domain/pagination/records-locator';

const ENDPOINT = new URL('https://api.example.org/v1/events');
const RECORDS = [{ id: 1 }, { id: 2 }];

function progress(overrides: Partial<PageProgress>): PageProgress {
  return {
    pages: 1,
    pageRecords: 100,
    totalRecords: 100,
    startOffset: 0,
    body: {},
    visited: new Set(),
    ...overrides,
  };
}

describe('locateRecords', () => {
  it.each([
    ['a top-level array', RECORDS],
    ['a data envelope', { data: RECORDS }],
    ['a nested envelope', { data: { items: RECORDS }, meta: { total: 2 } }],
    ['an OData value', { '@odata.count': 2, value: RECORDS }],
    ['a HAL embedded list', { _embedded: { events: RECORDS }, _links: {} }],
    ['a GeoJSON collection', { type: 'FeatureCollection', features: RECORDS }],
  ])('finds the list in %s', (_name, body) => {
    expect(locateRecords(body)).toEqual(RECORDS);
  });

  it('does not take a list of plain values for the records', () => {
    expect(locateRecords({ id: 1, items: ['a', 'b'] })).toBeNull();
  });

  it('lets an explicit path win over detection, wherever the list is', () => {
    const body = { data: [{ decoy: true }], payload: { rows: { list: RECORDS } } };

    expect(locateRecords(body, 'payload.rows.list')).toEqual(RECORDS);
    expect(locateRecords(body, 'payload.missing')).toBeNull();
  });

  it('reads an object at the path as a single record', () => {
    expect(locateRecords({ result: { id: 7 } }, 'result')).toEqual([{ id: 7 }]);
  });
});

describe('envelopes in discovery and mapping', () => {
  const body = {
    status: 'ok',
    data: { items: [{ id: 'a', address: { geo: { lat: 1, lon: 2 } } }] },
  };

  it('discovers the fields of the records inside the envelope, not the envelope', () => {
    const paths = discoverFromBody(body).fields.map((field) => field.path);

    expect(paths).toEqual(['id', 'address.geo.lat', 'address.geo.lon']);
  });

  it('discovers fields nested deeper than four levels', () => {
    const deep = [{ a: { b: { c: { d: { e: { f: 'x' } } } } } }];

    expect(discoverFromBody(deep).fields.map((field) => field.path)).toEqual(['a.b.c.d.e.f']);
  });

  it('treats a body without a list as one record', () => {
    expect(toRecordList({ id: 1, name: 'solo' })).toEqual([{ id: 1, name: 'solo' }]);
  });

  it('reports a truncated list against the budget it was given', () => {
    const mapping = { fields: [] } as never;
    const result = mapRecords({ mapping, body: [{}, {}, {}], hash: () => 'hash', limit: 2 });

    expect(result.truncated).toBe(true);
  });
});

describe('pagination strategies', () => {
  const offset: PaginationStrategy = {
    kind: 'offset',
    limitParam: 'limit',
    offsetParam: 'offset',
    pageSize: 100,
    placement: 'query',
  };

  it('asks for the first page and then continues from the records already read', () => {
    expect(firstPageRequest(offset, 0).request).toMatchObject({
      params: { limit: 100, offset: 0 },
    });
    expect(nextPageRequest(offset, progress({ totalRecords: 300 }))).toMatchObject({
      params: { limit: 100, offset: 300 },
    });
  });

  it('jumps straight to the window of an offset or page read, and walks for a cursor', () => {
    const page: PaginationStrategy = {
      kind: 'page',
      pageParam: 'page',
      sizeParam: null,
      firstPage: 1,
      pageSize: 50,
      placement: 'query',
    };
    const cursor: PaginationStrategy = {
      kind: 'cursor',
      cursorParam: 'after',
      nextCursorPath: 'next',
      sizeParam: null,
      pageSize: 50,
      placement: 'query',
    };

    expect(firstPageRequest(offset, 250)).toMatchObject({
      request: { params: { limit: 100, offset: 250 } },
      skip: 0,
    });
    expect(firstPageRequest(page, 130)).toMatchObject({
      request: { params: { page: 3 } },
      skip: 30,
    });
    expect(firstPageRequest(cursor, 130)).toEqual({ request: null, skip: 130 });
    expect(
      nextPageRequest(offset, progress({ startOffset: 250, totalRecords: 100 })),
    ).toMatchObject({
      params: { offset: 350 },
    });
  });

  it('stops at a short or empty page', () => {
    expect(nextPageRequest(offset, progress({ pageRecords: 40 }))).toBeNull();
    expect(nextPageRequest(offset, progress({ pageRecords: 0 }))).toBeNull();
  });

  it('counts pages from the configured first page', () => {
    const page: PaginationStrategy = {
      kind: 'page',
      pageParam: 'page',
      sizeParam: 'per_page',
      firstPage: 0,
      pageSize: 50,
      placement: 'query',
    };

    expect(firstPageRequest(page, 0).request).toMatchObject({ params: { page: 0, per_page: 50 } });
    expect(nextPageRequest(page, progress({ pages: 2, pageRecords: 50 }))).toMatchObject({
      params: { page: 2, per_page: 50 },
    });
  });

  it('follows a cursor from the answer and never requests one twice', () => {
    const cursor: PaginationStrategy = {
      kind: 'cursor',
      cursorParam: 'after',
      nextCursorPath: 'meta.next',
      sizeParam: null,
      pageSize: 100,
      placement: 'query',
    };
    const body = { meta: { next: 'abc' } };

    expect(firstPageRequest(cursor, 0).request).toBeNull();
    expect(nextPageRequest(cursor, progress({ body }))).toMatchObject({ params: { after: 'abc' } });
    expect(nextPageRequest(cursor, progress({ body, visited: new Set(['abc']) }))).toBeNull();
    expect(nextPageRequest(cursor, progress({ body: { meta: { next: null } } }))).toBeNull();
  });

  it('follows the next link an answer names', () => {
    const link: PaginationStrategy = { kind: 'next-url', nextUrlPath: 'links.next' };
    const next = nextPageRequest(
      link,
      progress({ body: { links: { next: '/v1/events?page=2' } } }),
    );

    expect(next).toEqual({ kind: 'url', url: '/v1/events?page=2' });
  });
});

describe('buildRequest', () => {
  it('puts parameters in the query string or in the body of a POST', () => {
    const query = buildRequest(ENDPOINT, null, {
      kind: 'params',
      placement: 'query',
      params: { limit: 10, offset: 20 },
    });
    const body = buildRequest(
      ENDPOINT,
      { filter: { year: 2026 } },
      { kind: 'params', placement: 'body', params: { 'page.number': 3 } },
    );

    expect(query?.url.search).toBe('?limit=10&offset=20');
    expect(body?.body).toEqual({ filter: { year: 2026 }, page: { number: 3 } });
    expect(body?.url.toString()).toBe(ENDPOINT.toString());
  });

  it('resolves a relative next link against the endpoint', () => {
    const request = buildRequest(ENDPOINT, null, { kind: 'url', url: '/v1/events?page=2' });

    expect(request?.url.toString()).toBe('https://api.example.org/v1/events?page=2');
  });

  it('refuses a next link that leaves the configured origin', () => {
    const elsewhere = { kind: 'url', url: 'https://evil.example.net/x' } as const;
    const metadata = { kind: 'url', url: 'http://169.254.169.254/' } as const;

    expect(buildRequest(ENDPOINT, null, elsewhere)).toBeNull();
    expect(buildRequest(ENDPOINT, null, metadata)).toBeNull();
  });
});

describe('createReadWindow', () => {
  it('accepts a window the connector can serve', () => {
    expect(createReadWindow({ limit: 50, offset: 100 }).isOk()).toBe(true);
    expect(firstRecords(5)).toEqual({ limit: 5, offset: 0 });
  });

  it.each([
    { limit: 0, offset: 0 },
    { limit: 1.5, offset: 0 },
    { limit: READ_WINDOW_LIMITS.maxLimit + 1, offset: 0 },
    { limit: 10, offset: -1 },
    { limit: 10, offset: READ_WINDOW_LIMITS.maxOffset + 1 },
  ])('refuses %j', (window) => {
    expect(createReadWindow(window).isErr()).toBe(true);
  });
});

describe('REST config', () => {
  const BASE = {
    baseUrl: 'https://api.example.org/v1',
    path: '/events',
    authMode: 'NONE',
  } as const;
  const parse = (extra: Record<string, unknown>) =>
    parseRestConnectionConfig({ ...BASE, ...extra });

  it('keeps a config stored before pagination existed valid, with no pagination', () => {
    const config = parse({})._unsafeUnwrap();

    expect(config).toMatchObject({
      method: 'GET',
      recordsPath: null,
      pagination: { kind: 'none' },
    });
  });

  it('reads a complete pagination block and a records path', () => {
    const config = parse({
      recordsPath: 'data.items',
      pagination: { kind: 'offset', limitParam: 'limit', offsetParam: 'offset', pageSize: 50 },
    })._unsafeUnwrap();

    expect(config.recordsPath).toBe('data.items');
    expect(config.pagination).toMatchObject({ kind: 'offset', pageSize: 50, placement: 'query' });
  });

  it.each([
    ['an unknown strategy', { pagination: { kind: 'magic' } }],
    ['an offset without its parameters', { pagination: { kind: 'offset', limitParam: 'limit' } }],
    ['an absurd page size', { pagination: { kind: 'page', pageParam: 'p', pageSize: 100_000 } }],
    [
      'a parameter that could pollute a prototype',
      { pagination: { kind: 'page', pageParam: '__proto__' } },
    ],
    [
      'body parameters on a GET source',
      { pagination: { kind: 'page', pageParam: 'p', placement: 'body' } },
    ],
    ['a request body on a GET source', { requestBody: { a: 1 } }],
    ['an unsafe records path', { recordsPath: 'a.__proto__.b' }],
    ['an unsupported method', { method: 'DELETE' }],
  ])('rejects %s', (_name, extra) => {
    expect(parse(extra).isErr()).toBe(true);
  });

  it('accepts body pagination on a POST source', () => {
    const config = parse({
      method: 'POST',
      requestBody: { filter: 'open' },
      pagination: { kind: 'page', pageParam: 'page.number', placement: 'body' },
    });

    expect(config.isOk()).toBe(true);
  });
});
