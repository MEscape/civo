import { describe, expect, it } from 'vitest';

import { mapNotFound } from '@modules/map/domain/errors/map-errors';
import { MAP_FEATURE_LIMITS } from '@modules/map/domain/features/map-features';
import { WORLD_BOUNDS } from '@modules/map/domain/geo/geometry';
import { DatasetMapSource } from '@modules/map/infrastructure/data-sources/dataset-map-source';

import { errAsync, okAsync } from '@lib/result';

import { DATASET_ID, VIEWPORT, WEBSITE_ID } from '../../support/map-fakes';

interface MappedRecord {
  readonly id: string;
  readonly values: unknown;
}
type SourceRequest = Parameters<ConstructorParameters<typeof DatasetMapSource>[0]>[0];
const LAYER = { datasetId: DATASET_ID, label: 'Buildings' };
const MAX_RECORDS = 10_000;

function record(id: string, values: Readonly<Record<string, unknown>> = {}): MappedRecord {
  return { id, values: { name: `Building ${id}`, longitude: 10, latitude: 51, ...values } };
}

function sourceFor(
  records: readonly MappedRecord[],
  options: { canonicalKind?: string; truncated?: boolean; isAreaApplied?: boolean } = {},
) {
  const requests: SourceRequest[] = [];
  const source = new DatasetMapSource(
    (request) => {
      requests.push(request);
      return okAsync({
        canonicalKind: options.canonicalKind ?? 'GeoFeature',
        records,
        truncated: options.truncated ?? false,
        isAreaApplied: options.isAreaApplied ?? false,
      });
    },
    () => okAsync({ items: [], isTruncated: false }),
    MAX_RECORDS,
  );
  return { source, requests };
}

function read(source: DatasetMapSource, limit = 5) {
  return source.readWindow({ websiteId: WEBSITE_ID, layer: LAYER, bounds: VIEWPORT, limit });
}

describe('DatasetMapSource', () => {
  it('widens a spatial fallback only within the source-specific read budget', async () => {
    const requested: number[] = [];
    const records = [record('one'), record('two')];
    const source = new DatasetMapSource(
      (request) => {
        requested.push(request.window.limit);
        if (request.window.limit > 2) {
          return errAsync(mapNotFound());
        }
        return okAsync({
          canonicalKind: 'GeoFeature',
          records: records.slice(0, request.window.limit),
          truncated: request.window.limit < records.length,
          isAreaApplied: false,
          maxWindowRecords: 2,
        });
      },
      () => okAsync({ items: [], isTruncated: false }),
      MAX_RECORDS,
    );
    const result = await read(source, 1);
    expect(result.isOk()).toBe(true);
    expect(requested).toEqual([1, 2]);
    if (result.isOk()) {
      expect(result.value.layer.features[0]?.id).toBe('one');
    }
  });
  it('asks the source for the window widened to a grid, and reads more only when it cannot filter', async () => {
    const plain = sourceFor([record('town-hall')]);
    expect((await read(plain.source, 25)).isOk()).toBe(true);
    const area = [9, 50, 11, 52];
    expect(plain.requests.map((request) => request.window)).toEqual([
      { bounds: area, limit: 25, offset: 0 },
      { bounds: area, limit: MAX_RECORDS, offset: 0 },
    ]);

    // Windows that differ by a pixel ask for the same area, so the source's cache serves them both.
    const nudged = sourceFor([record('town-hall')], { isAreaApplied: true });
    await nudged.source.readWindow({
      websiteId: WEBSITE_ID,
      layer: LAYER,
      bounds: [9.0031, 50.0042, 10.9907, 51.9963],
      limit: 25,
    });
    expect(nudged.requests[0]?.window.bounds).toEqual([9, 50, 11, 52]);

    const filtering = sourceFor([record('town-hall')], { isAreaApplied: true });
    await read(filtering.source, 25);
    expect(filtering.requests).toHaveLength(1);
    expect(filtering.requests[0]?.window.limit).toBe(25);

    const world = sourceFor([record('town-hall')]);
    await world.source.readWindow({
      websiteId: WEBSITE_ID,
      layer: LAYER,
      bounds: WORLD_BOUNDS,
      limit: 25,
    });
    expect(world.requests.map((request) => request.window)).toEqual([{ limit: 25, offset: 0 }]);
  });

  it('keeps the records inside the window before the limit is applied, and the ones with no place', async () => {
    const records = [
      record('far-away', { longitude: 100, latitude: -30 }),
      record('inside-a'),
      record('crossing', {
        longitude: undefined,
        latitude: undefined,
        geometry: {
          type: 'LineString',
          coordinates: [
            [8, 51],
            [12, 51],
          ],
        },
      }),
      record('inside-b'),
      record('nowhere', { longitude: undefined, latitude: undefined }),
    ];
    const result = await read(sourceFor(records).source, 2);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.layer.features.map((feature) => feature.id)).toEqual([
        'nowhere',
        'inside-a',
        'crossing',
      ]);
      // inside-b was left out by the limit, never the region's first records by accident of order.
      expect(result.value.isTruncated).toBe(true);
    }
  });

  it('refuses a dataset of a different canonical kind', async () => {
    const result = await read(sourceFor([record('service')], { canonicalKind: 'Service' }).source);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('map.not_found');
    }
  });

  it('bounds an oversized returned batch and signals that records were omitted', async () => {
    const result = await read(sourceFor([record('one'), record('two'), record('three')]).source, 2);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.isTruncated).toBe(true);
      expect(result.value.layer.features.map((feature) => feature.id)).toEqual(['one', 'two']);
      expect(result.value.layer.rejectedFeatures).toBe(0);
    }
  });

  it('preserves upstream truncation even when the returned batch fits the budget', async () => {
    const result = await read(sourceFor([record('one')], { truncated: true }).source);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.isTruncated).toBe(true);
    }
  });

  it('preserves property-bag values when their canonical field is absent', async () => {
    const result = await read(
      sourceFor([
        record('one', {
          properties: { value: 42, category: 'Civic', status: 'open', unit: 'visits' },
        }),
      ]).source,
    );
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.layer.features[0]?.attributes).toEqual({
        value: 42,
        category: 'Civic',
        status: 'open',
        unit: 'visits',
      });
    }
  });

  it('lets defined canonical values override properties, including zero and false', async () => {
    const result = await read(
      sourceFor([
        record('one', {
          properties: { value: 42, category: 'Old category', status: true },
          value: 0,
          category: 'Civic',
          status: false,
        }),
      ]).source,
    );
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.layer.features[0]?.attributes).toEqual({
        value: 0,
        category: 'Civic',
        status: false,
      });
    }
  });

  it('normalizes Date instants from mapping transforms to JSON-safe ISO text', async () => {
    const instant = new Date('2026-10-30T12:34:56.000Z');
    const result = await read(sourceFor([record('one', { observedAt: instant })]).source);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.layer.features[0]?.attributes['observedAt']).toBe(
        '2026-10-30T12:34:56.000Z',
      );
    }
  });

  it.each([
    ['name', { name: 'x'.repeat(MAP_FEATURE_LIMITS.label + 1) }],
    ['description', { description: 'x'.repeat(MAP_FEATURE_LIMITS.description + 1) }],
    ['href', { href: 'x'.repeat(MAP_FEATURE_LIMITS.href + 1) }],
    [
      'property count',
      {
        properties: Object.fromEntries(
          Array.from({ length: MAP_FEATURE_LIMITS.properties + 1 }, (_, index) => [
            `field-${String(index)}`,
            index,
          ]),
        ),
      },
    ],
    ['property key', { properties: { ['x'.repeat(MAP_FEATURE_LIMITS.propertyKey + 1)]: 'value' } }],
    ['property text', { properties: { label: 'x'.repeat(MAP_FEATURE_LIMITS.propertyText + 1) } }],
  ] as const)(
    'rejects oversized %s and reports the loss without dropping valid neighboring records',
    async (_name, invalid) => {
      const result = await read(sourceFor([record('valid'), record('oversized', invalid)]).source);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.layer.features.map((feature) => feature.id)).toEqual(['valid']);
        expect(result.value.layer.rejectedFeatures).toBe(1);
        expect(result.value.isTruncated).toBe(false);
      }
    },
  );

  it('counts malformed record names rather than silently losing them before model construction', async () => {
    const result = await read(
      sourceFor([record('missing-name', { name: undefined }), record('empty-name', { name: ' ' })])
        .source,
    );
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.layer.features).toEqual([]);
      expect(result.value.layer.rejectedFeatures).toBe(2);
    }
  });

  it('validates every selected layer through an upstream request scoped to the same website', async () => {
    const requests: SourceRequest[] = [];
    const source = new DatasetMapSource(
      (request) => {
        requests.push(request);
        return request.datasetId === DATASET_ID
          ? okAsync({
              canonicalKind: 'GeoFeature',
              records: [],
              truncated: false,
              isAreaApplied: false,
            })
          : errAsync(mapNotFound());
      },
      () => okAsync({ items: [], isTruncated: false }),
      MAX_RECORDS,
    );
    const layers = [LAYER, { datasetId: 'foreign-dataset', label: 'Foreign layer' }];
    const result = await source.validateLayers(WEBSITE_ID, layers);
    expect(result.isErr()).toBe(true);
    expect(requests).toEqual(
      layers.map((layer) => ({
        websiteId: WEBSITE_ID,
        datasetId: layer.datasetId,
        window: { limit: 1, offset: 0 },
      })),
    );
  });
});
