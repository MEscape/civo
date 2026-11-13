import { describe, expect, it } from 'vitest';

import type {
  ComponentDescriptor,
  PropFieldDescriptor,
} from '@modules/builder/application/contracts/builder-constraints';
import type { ComponentCatalog } from '@modules/builder/application/contracts/editor-model';
import { visibleFields } from '@modules/builder/presentation/properties/visible-fields';

const field = (key: string, control: PropFieldDescriptor['control']) =>
  ({ key, control }) as PropFieldDescriptor;

const descriptor = (fields: readonly PropFieldDescriptor[]) =>
  ({ type: 'any', fields }) as unknown as ComponentDescriptor;

const catalog = (allowed: ReadonlySet<string> | null) =>
  ({ editablePropKeys: () => allowed }) as unknown as ComponentCatalog;

const keys = (fields: readonly PropFieldDescriptor[]) => fields.map((entry) => entry.key);

describe('visibleFields', () => {
  const map = descriptor([
    field('savedMapId', 'map'),
    field('primaryDatasetId', 'dataset'),
    field('heading', 'text'),
    field('pointStyle', 'select'),
    field('showLegend', 'switch'),
  ]);

  it('offers only the map picker and the heading for a component that places saved maps', () => {
    expect(keys(visibleFields(map, true, catalog(null)))).toEqual(['savedMapId', 'heading']);
  });

  it('still applies what the session may edit', () => {
    expect(keys(visibleFields(map, false, catalog(new Set(['heading']))))).toEqual(['heading']);
  });

  it('leaves every other component untouched', () => {
    const list = descriptor([field('datasetId', 'dataset'), field('heading', 'text')]);
    expect(keys(visibleFields(list, true, catalog(null)))).toEqual(['datasetId', 'heading']);
  });
});
