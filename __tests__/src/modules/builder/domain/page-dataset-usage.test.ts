import { describe, expect, it } from 'vitest';

import { createComponentCatalog } from '@modules/builder/domain/models/component-catalog';
import type { ComponentDescriptor } from '@modules/builder/domain/models/component-descriptor';
import type { PageConfig } from '@modules/builder/domain/models/page-config';
import {
  componentsAwaitingDataOf,
  datasetUsesOf,
  mapsAwaitingChoiceOf,
  savedMapIdsOf,
} from '@modules/builder/domain/models/page-dataset-usage';

const catalog = createComponentCatalog([
  {
    type: 'map',
    fields: [
      { key: 'savedMapId', control: 'map' },
      { key: 'primaryDatasetId', control: 'dataset', canonicalKind: 'GeoFeature' },
    ],
  },
  { type: 'section', fields: [] },
  { type: 'events', fields: [{ key: 'datasetId', control: 'dataset', canonicalKind: 'Event' }] },
  {
    type: 'chart',
    fields: [{ key: 'datasetIds', control: 'datasets', canonicalKind: 'SmartCityMetric' }],
  },
  { type: 'text', fields: [{ key: 'body', control: 'text' }] },
  {
    type: 'split',
    fields: [
      { key: 'newsDatasetId', control: 'dataset', canonicalKind: 'NewsItem' },
      { key: 'eventsDatasetId', control: 'dataset', canonicalKind: 'Event' },
    ],
  },
] as unknown as readonly ComponentDescriptor[]);

const node = (type: string, props: Record<string, unknown>, children: unknown[] = []) => ({
  id: `node-${type}`,
  type,
  props,
  children,
});
const page = (...children: unknown[]) => ({ type: 'page', children }) as unknown as PageConfig;

describe('datasetUsesOf', () => {
  it('ignores overridden inline bindings but still visits a saved map node children', () => {
    const config = page(
      node('map', { savedMapId: 'map-1', primaryDatasetId: 'unused' }, [
        node('events', { datasetId: 'nested' }),
      ]),
    );
    expect(datasetUsesOf(config, catalog)).toEqual([
      { datasetId: 'nested', nodeId: 'node-events', type: 'events' },
    ]);
  });
  it('finds each component reading a dataset, through single and list fields at any depth', () => {
    const config = page(
      node('events', { datasetId: 'd1' }),
      node('section', {}, [node('chart', { datasetIds: ['d2', 'd1', 'd2', 7] })]),
    );

    expect(datasetUsesOf(config, catalog)).toEqual([
      { datasetId: 'd1', nodeId: 'node-events', type: 'events' },
      { datasetId: 'd2', nodeId: 'node-chart', type: 'chart' },
      { datasetId: 'd1', nodeId: 'node-chart', type: 'chart' },
    ]);
  });

  it('ignores props that are not dataset fields and components the catalog no longer knows', () => {
    const config = page(
      node('text', { body: 'd9' }),
      node('removed', { datasetId: 'd3' }),
      node('events', {}),
    );

    expect(datasetUsesOf(config, catalog)).toEqual([]);
  });
});

describe('componentsAwaitingDataOf', () => {
  it('a map component waits for a saved map, not for a dataset', () => {
    expect(componentsAwaitingDataOf(page(node('map', { savedMapId: 'map-1' })), catalog)).toEqual(
      [],
    );
    expect(componentsAwaitingDataOf(page(node('map', {})), catalog)).toEqual([]);
    expect(mapsAwaitingChoiceOf(page(node('map', {})), catalog)).toEqual([
      { nodeId: 'node-map', type: 'map' },
    ]);
    expect(mapsAwaitingChoiceOf(page(node('map', { savedMapId: 'map-1' })), catalog)).toEqual([]);
  });
  it('finds the components with no dataset chosen yet, with the kind they ask for', () => {
    const config = page(
      node('events', {}),
      node('section', {}, [node('chart', { datasetIds: [] })]),
      node('text', { body: 'x' }),
    );

    expect(componentsAwaitingDataOf(config, catalog)).toEqual([
      { nodeId: 'node-events', type: 'events', kind: 'Event' },
      { nodeId: 'node-chart', type: 'chart', kind: 'SmartCityMetric' },
    ]);
  });

  it('lists a component reading two kinds once for each empty field', () => {
    const config = page(node('split', { newsDatasetId: 'd1' }), node('split', {}));

    expect(componentsAwaitingDataOf(config, catalog).map(({ kind }) => kind)).toEqual([
      'Event',
      'NewsItem',
      'Event',
    ]);
  });

  it('skips components that already read a dataset', () => {
    const config = page(node('events', { datasetId: 'd1' }), node('chart', { datasetIds: ['d2'] }));

    expect(componentsAwaitingDataOf(config, catalog)).toEqual([]);
  });
});

describe('savedMapIdsOf', () => {
  it('finds the saved maps a page places, at any depth, once each', () => {
    const config = page(
      node('map', { savedMapId: 'map-1' }),
      node('section', {}, [
        node('map', { savedMapId: 'map-2' }),
        node('map', { savedMapId: 'map-1' }),
      ]),
    );

    expect([...savedMapIdsOf(config, catalog)]).toEqual(['map-1', 'map-2']);
  });

  it('ignores an unset map, inline bindings and components the catalog no longer knows', () => {
    const config = page(
      node('map', { primaryDatasetId: 'd1' }),
      node('map', { savedMapId: '' }),
      node('gone', { savedMapId: 'map-9' }),
      node('events', { datasetId: 'd2' }),
    );

    expect(savedMapIdsOf(config, catalog).size).toBe(0);
  });
});
