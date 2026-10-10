import { describe, expect, it } from 'vitest';

import { toCatalogEntry } from '@modules/component-platform/application/component-platform-view-mappers';
import { serviceFinderDefinition } from '@modules/component-platform/domain/components/civic/service-finder.component';
import { wasteCalendarDefinition } from '@modules/component-platform/domain/components/civic/waste-calendar.component';
import { COMPONENT_DEFINITIONS } from '@modules/component-platform/domain/components/component-definitions';
import { createComponentRegistry } from '@modules/component-platform/domain/components/component-registry';
import { defineComponent } from '@modules/component-platform/domain/components/define-component';
import { prop } from '@modules/component-platform/domain/models/prop-field';

import { isJsonValue } from '@lib/utils';

function field(entry: ReturnType<typeof toCatalogEntry>, key: string) {
  const found = entry.fields.find((candidate) => candidate.key === key);
  if (found === undefined) {
    throw new Error(`No field ${key}`);
  }
  return found;
}

describe('the waste calendar props', () => {
  it('keeps a page stored before further datasets existed valid and unchanged', () => {
    const stored = { datasetId: 'ds-1', district: 'Bezirk A', limit: 5, heading: 'Müll' };

    expect(wasteCalendarDefinition.parseProps(stored)).toEqual({
      ...stored,
      additionalDatasetIds: [],
    });
  });

  it('starts without further datasets', () => {
    expect(wasteCalendarDefinition.parseProps({}).additionalDatasetIds).toEqual([]);
  });

  it('keeps a list of further datasets', () => {
    const parsed = wasteCalendarDefinition.parseProps({ additionalDatasetIds: ['ds-2', 'ds-3'] });

    expect(parsed.additionalDatasetIds).toEqual(['ds-2', 'ds-3']);
  });

  it('drops the whole list when it is too long or holds something that is not an id', () => {
    const tooMany = Array.from({ length: 9 }, (_, index) => `ds-${String(index)}`);

    expect(wasteCalendarDefinition.parseProps({ additionalDatasetIds: tooMany })).toMatchObject({
      additionalDatasetIds: [],
    });
    expect(wasteCalendarDefinition.parseProps({ additionalDatasetIds: ['ds-2', 7] })).toMatchObject(
      {
        additionalDatasetIds: [],
      },
    );
    expect(wasteCalendarDefinition.parseProps({ additionalDatasetIds: 'ds-2' })).toMatchObject({
      additionalDatasetIds: [],
    });
  });

  it('keeps the stored district as written, even if the data no longer offers it', () => {
    expect(wasteCalendarDefinition.parseProps({ district: ' Bezirk Z ' }).district).toBe(
      'Bezirk Z',
    );
    expect(wasteCalendarDefinition.parseProps({}).district).toBeUndefined();
    expect(wasteCalendarDefinition.parseProps({ district: 5 }).district).toBeUndefined();
  });

  it('is edited with a dataset list and a category choice read from the waste data', () => {
    const entry = toCatalogEntry(wasteCalendarDefinition);

    expect(field(entry, 'datasetId')).toMatchObject({
      control: 'dataset',
      canonicalKind: 'WasteCollectionEntry',
    });
    expect(field(entry, 'additionalDatasetIds')).toMatchObject({
      control: 'datasets',
      group: 'data',
      canonicalKind: 'WasteCollectionEntry',
      bounds: { min: 0, max: 8 },
    });
    expect(field(entry, 'district')).toMatchObject({
      control: 'category',
      canonicalKind: 'WasteCollectionEntry',
    });
  });
});

describe('the service finder start category', () => {
  it('is a category choice, not free text', () => {
    const entry = toCatalogEntry(serviceFinderDefinition);

    expect(field(entry, 'initialCategory')).toMatchObject({
      control: 'category',
      canonicalKind: 'ServiceDetail',
    });
  });

  it('keeps a start category stored as text', () => {
    expect(serviceFinderDefinition.parseProps({ initialCategory: 'Bauen' }).initialCategory).toBe(
      'Bauen',
    );
  });
});

describe('default values in the catalog', () => {
  const entries = COMPONENT_DEFINITIONS.map(toCatalogEntry);

  function entryOf(type: string) {
    const found = entries.find((candidate) => candidate.type === type);
    if (found === undefined) {
      throw new Error(`No component ${type}`);
    }
    return found;
  }

  it('gives every count and column control the value the page renders by default', () => {
    const controls = entries.flatMap((entry) =>
      entry.fields
        .filter((candidate) => candidate.control === 'number' || candidate.control === 'columns')
        .map((candidate) => ({ type: entry.type, candidate })),
    );

    expect(controls.length).toBeGreaterThan(0);
    for (const { type, candidate } of controls) {
      expect(candidate.defaultValue, `${type}.${candidate.key}`).toEqual(
        entryOf(type).blueprint.props[candidate.key],
      );
      expect(typeof candidate.defaultValue, `${type}.${candidate.key}`).toBe('number');
    }
  });

  it('shows the declared defaults of the alert banner and the grids', () => {
    expect(field(entryOf('alertBanner'), 'limit').defaultValue).toBe(3);
    expect(field(entryOf('eventsGrid'), 'columns').defaultValue).toBe(3);
    expect(field(entryOf('departmentDirectory'), 'columns').defaultValue).toBe(2);
  });

  it('carries only JSON, because the catalog travels to the browser', () => {
    for (const entry of entries) {
      for (const candidate of entry.fields) {
        expect(isJsonValue(candidate.defaultValue), `${entry.type}.${candidate.key}`).toBe(true);
      }
    }
  });

  it('has no default for a prop that starts unset', () => {
    expect(field(entryOf('alertBanner'), 'heading').defaultValue).toBeNull();
    expect(field(entryOf('wasteCalendar'), 'district').defaultValue).toBeNull();
  });
});

describe('the registry', () => {
  it('rejects a dataset-reading prop on a component without a data binding', () => {
    const unbound = defineComponent({
      type: 'unbound',
      category: 'content',
      props: { choice: prop.category(40) },
    });

    expect(() => createComponentRegistry([unbound])).toThrow(/declares no data binding/);
  });
});
