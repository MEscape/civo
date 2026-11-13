import { describe, expect, it } from 'vitest';

import { toTenantId } from '@modules/auth';
import { parseRestConnectionConfig } from '@modules/data-sources/domain/config/rest-connection-config';
import {
  checkSpatialFilter,
  spatialFilterValue,
} from '@modules/data-sources/domain/config/spatial-filter';
import { createDataSourceErrorBag } from '@modules/data-sources/domain/errors/data-source-errors';
import { toDataSourceId } from '@modules/data-sources/domain/models/ids';
import { withArea } from '@modules/data-sources/domain/pagination/apply-area';
import { createReadWindow } from '@modules/data-sources/domain/pagination/read-window';
import { RestJsonConnector } from '@modules/data-sources/infrastructure/connector/rest-json-connector';

import { okAsync } from '@lib/result';

const BASE = 'https://api.example.org/v1/places';
const AREA = [9.1, 47.5, 9.4, 47.8] as const;
const FILTER = { param: 'where', template: 'in_bbox(geo, {south}, {west}, {north}, {east})' };

function check(raw: unknown) {
  const bag = createDataSourceErrorBag();
  const filter = checkSpatialFilter(raw, bag);
  return { filter, fields: Object.keys(bag.toError().fieldErrors ?? {}) };
}

describe('the area filter of a source', () => {
  it('is optional, and accepts a parameter with a template that names the corners', () => {
    expect(check(undefined)).toEqual({ filter: null, fields: [] });
    expect(check(FILTER)).toEqual({ filter: FILTER, fields: [] });
    expect(
      check({ param: 'bbox', template: '{west},{south},{east},{north}' }).filter,
    ).not.toBeNull();
  });

  it.each([
    [
      'a template with no corner in it',
      { param: 'where', template: 'all' },
      'config.spatialFilter.template',
    ],
    [
      'a corner that does not exist',
      { param: 'where', template: '{middle}' },
      'config.spatialFilter.template',
    ],
    ['stray braces', { param: 'where', template: '{west} {' }, 'config.spatialFilter.template'],
    [
      'a parameter that is not a name',
      { param: 'a b&c', template: '{west}' },
      'config.spatialFilter.param',
    ],
    ['no parameter', { param: '', template: '{west}' }, 'config.spatialFilter.param'],
    ['something else than an object', 'bbox', 'config.spatialFilter'],
  ])('refuses %s', (_name, raw, field) => {
    const result = check(raw);
    expect(result.filter).toBeUndefined();
    expect(result.fields).toContain(field);
  });

  it('is kept in a config only when there is one', () => {
    const base = { baseUrl: BASE, path: '/', authMode: 'NONE' };
    const without = parseRestConnectionConfig(base);
    const withFilter = parseRestConnectionConfig({ ...base, spatialFilter: FILTER });
    expect(without.isOk() && 'spatialFilter' in without.value).toBe(false);
    expect(withFilter.isOk() && withFilter.value.spatialFilter).toEqual(FILTER);
    expect(parseRestConnectionConfig({ ...base, spatialFilter: { param: 'x' } }).isErr()).toBe(
      true,
    );
  });

  it('writes the corners as plain numbers, whatever the window held', () => {
    expect(spatialFilterValue(FILTER, AREA)).toBe('in_bbox(geo, 47.5, 9.1, 47.8, 9.4)');
    expect(
      spatialFilterValue(
        { param: 'bbox', template: '{west},{south}' },
        [9.1234567891, -0.5, 10, 11],
      ),
    ).toBe('9.123457,-0.5');
  });
});

describe('a read window with an area', () => {
  it('accepts a sane area and refuses an upside-down or out-of-world one', () => {
    expect(createReadWindow({ limit: 10, offset: 0, bounds: AREA }).isOk()).toBe(true);
    expect(createReadWindow({ limit: 10, offset: 0 }).isOk()).toBe(true);
    for (const bounds of [
      [9.4, 47.5, 9.1, 47.8],
      [9.1, 47.8, 9.4, 47.5],
      [-181, 0, 0, 1],
      [0, 0, 1, 91],
      [Number.NaN, 0, 1, 1],
    ] as const) {
      expect(createReadWindow({ limit: 10, offset: 0, bounds }).isErr()).toBe(true);
    }
  });

  it('adds the condition to the query of a GET source and to the body of a POST source', () => {
    const base = { endpoint: new URL(`${BASE}?lang=de`), requestBody: { query: { size: 5 } } };
    const get = withArea(base, { method: 'GET', filter: FILTER, bounds: AREA });
    expect(get.endpoint.searchParams.get('where')).toBe('in_bbox(geo, 47.5, 9.1, 47.8, 9.4)');
    expect(get.endpoint.searchParams.get('lang')).toBe('de');
    const post = withArea(base, {
      method: 'POST',
      filter: { param: 'query.filter', template: '{west}' },
      bounds: AREA,
    });
    expect(post.requestBody).toEqual({ query: { size: 5, filter: '9.1' } });
    expect(withArea(base, { method: 'GET', filter: null, bounds: AREA })).toBe(base);
    expect(withArea(base, { method: 'GET', filter: FILTER, bounds: undefined })).toBe(base);
  });
});

describe('RestJsonConnector asking for an area', () => {
  function connector(urls: string[]) {
    return new RestJsonConnector({
      credentials: { resolve: () => okAsync({ mode: 'NONE' as const }) },
      resolveHost: () => Promise.resolve(['93.184.216.34']),
      fetchImplementation: (input) => {
        urls.push(new Request(input).url);
        return Promise.resolve(
          new Response(JSON.stringify([{ id: 1 }]), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      },
    });
  }
  const target = (config: Record<string, unknown>) => ({
    tenantId: toTenantId('00000000000000000000000000000001'),
    dataSourceId: toDataSourceId('00000000000000000000000000000002'),
    rawConfig: { baseUrl: BASE, path: '/', authMode: 'NONE', ...config },
  });

  it('sends the area to an API that can be asked for it', async () => {
    const urls: string[] = [];
    await connector(urls).fetchRestBody({
      target: target({ spatialFilter: FILTER }),
      window: { limit: 10, offset: 0, bounds: AREA },
    });
    expect(new URL(urls[0] ?? '').searchParams.get('where')).toBe(
      'in_bbox(geo, 47.5, 9.1, 47.8, 9.4)',
    );
  });

  it('sends no area to an API that was not set up for it, or when none is wanted', async () => {
    const urls: string[] = [];
    await connector(urls).fetchRestBody({
      target: target({}),
      window: { limit: 10, offset: 0, bounds: AREA },
    });
    await connector(urls).fetchRestBody({
      target: target({ spatialFilter: FILTER }),
      window: { limit: 10, offset: 0 },
    });
    expect(urls.every((url) => !new URL(url).searchParams.has('where'))).toBe(true);
  });
});
