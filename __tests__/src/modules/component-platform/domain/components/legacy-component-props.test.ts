import { describe, expect, it } from 'vitest';

import { getComponentDefinition } from '@modules/component-platform/domain/components/component-definitions';
import {
  migrateCategoryProps,
  readLegacyComponentDefaults,
} from '@modules/component-platform/domain/components/legacy-component-props';
import { getContentDefinition } from '@modules/component-platform/domain/content/content-definitions';

const HISTORICAL = [
  { type: 'kpiGrid', version: 1, defaults: { category: 'all', columns: 3 } },
  { type: 'metricChart', version: 1, defaults: { category: 'all' } },
  { type: 'metricComparisonChart', version: 1, defaults: { category: 'all' } },
  { type: 'metricTable', version: 1, defaults: { category: 'all' } },
  { type: 'metricTrendChart', version: 1, defaults: { limit: 500, category: 'all' } },
  {
    type: 'dashboardGrid',
    version: 3,
    defaults: {
      limit: 500,
      category: 'all',
      showKpis: true,
      showTrend: true,
      showBreakdown: true,
      columns: 4,
    },
  },
] as const;

describe('historical component defaults', () => {
  it.each(HISTORICAL)(
    'keeps $type v$version defaults frozen and exact',
    ({ type, version, defaults }) => {
      const previous = readLegacyComponentDefaults(type, version);

      expect(previous).toEqual(defaults);
      expect(Object.isFrozen(previous)).toBe(true);
      expect(Reflect.set(previous ?? {}, 'category', 'changed')).toBe(false);
      expect(readLegacyComponentDefaults(type, version)).toEqual(defaults);
    },
  );

  it.each(HISTORICAL)(
    'does not use $type historical defaults for another version',
    ({ type, version }) => {
      expect(readLegacyComponentDefaults(type, version + 1)).toBeNull();
      expect(readLegacyComponentDefaults(type, version - 1)).toBeNull();
    },
  );

  it.each(['unknown', 'constructor', '__proto__', 'toString'])(
    'does not inherit defaults for %s',
    (type) => {
      expect(readLegacyComponentDefaults(type, 1)).toBeNull();
    },
  );

  it.each(HISTORICAL)(
    'still reads stored $type props without changing their meaning',
    ({ type, defaults }) => {
      const stored = { ...defaults, heading: 'Gespeicherte Ansicht', datasetId: 'source-1' };

      expect(getComponentDefinition(type).parseProps(stored)).toMatchObject(stored);
      for (const category of ['sustainability', 'mobility', 'energy', 'other']) {
        expect(getComponentDefinition(type).parseProps({ category }).category).toBe(category);
      }
    },
  );

  it.each(HISTORICAL)(
    'keeps custom $type categories and leaves missing grouping unset',
    ({ type }) => {
      expect(
        getComponentDefinition(type).parseProps({ category: 'Wasser & Gesundheit' }).category,
      ).toBe('Wasser & Gesundheit');
      expect(getComponentDefinition(type).parseProps({}).category).toBeUndefined();
    },
  );

  it('keeps an uncategorized observation ungrouped instead of inventing other', () => {
    const parsed = getContentDefinition('SmartCityMetric').parse({
      id: 'reading-1',
      label: 'Pegelstand',
      value: 178,
      unit: 'cm',
    });

    expect(parsed.isOk()).toBe(true);
    expect(parsed._unsafeUnwrap().category).toBe('');
  });
});

describe('category props migration', () => {
  it.each(HISTORICAL)('removes only unfiltered $type sentinels and is idempotent', ({ type }) => {
    for (const category of ['all', '']) {
      const nested = { keep: ['source-defined', 'values'] };
      const raw = Object.freeze({ category, heading: 'Messwerte', nested, unknown: null });
      const migrated = migrateCategoryProps(type, raw);

      expect(migrated).toEqual({ heading: 'Messwerte', nested, unknown: null });
      expect(migrated).not.toBe(raw);
      expect(raw.category).toBe(category);
      expect(migrateCategoryProps(type, migrated)).toBe(migrated);
    }
  });

  it.each(['sustainability', 'mobility', 'energy', 'other', 'Wasser', ' all '])(
    'preserves the exact named taxonomy %s',
    (category) => {
      const raw = { category, heading: 'Messwerte' };

      expect(migrateCategoryProps('kpiGrid', raw)).toBe(raw);
    },
  );

  it.each(['newsGrid', 'unknown', 'constructor', '__proto__'])(
    'leaves other component %s unchanged',
    (type) => {
      const raw = { category: 'all', heading: 'Unverändert' };

      expect(migrateCategoryProps(type, raw)).toBe(raw);
    },
  );

  it.each([null, undefined, 'all', 3, ['all']])('leaves non-object props %j unchanged', (raw) => {
    expect(migrateCategoryProps('kpiGrid', raw)).toBe(raw);
  });

  it('retains an own prototype-like sibling as data', () => {
    const raw = Object.fromEntries([
      ['category', 'all'],
      ['__proto__', { safe: true }],
    ]);
    const migrated = migrateCategoryProps('kpiGrid', raw);

    expect(migrated).toEqual(Object.fromEntries([['__proto__', { safe: true }]]));
    expect(Object.getPrototypeOf(migrated)).toBe(Object.prototype);
  });
});
