import { hasOwnKey, isPlainObject, omit } from '@lib/utils';

const LEGACY_ALL_CATEGORIES = 'all';
const LEGACY_QUICK_LINKS_DEFAULTS = Object.freeze({ links: Object.freeze([]) });
const LEGACY_SECTION_DEFAULTS = Object.freeze({ tone: 'default' });
const LEGACY_WASTE_CALENDAR_DEFAULTS = Object.freeze({
  additionalDatasetIds: Object.freeze([]),
  limit: 10,
});

/** Historical JSON defaults are snapshots, never derived from the current component definitions. */
const LEGACY_COMPONENT_DEFAULTS = Object.freeze({
  kpiGrid: Object.freeze({
    version: 1,
    props: Object.freeze({ category: LEGACY_ALL_CATEGORIES, columns: 3 }),
  }),
  metricChart: Object.freeze({
    version: 1,
    props: Object.freeze({ category: LEGACY_ALL_CATEGORIES }),
  }),
  metricComparisonChart: Object.freeze({
    version: 1,
    props: Object.freeze({ category: LEGACY_ALL_CATEGORIES }),
  }),
  metricTable: Object.freeze({
    version: 1,
    props: Object.freeze({ category: LEGACY_ALL_CATEGORIES }),
  }),
  metricTrendChart: Object.freeze({
    version: 1,
    props: Object.freeze({ limit: 500, category: LEGACY_ALL_CATEGORIES }),
  }),
  dashboardGrid: Object.freeze({
    version: 3,
    props: Object.freeze({
      limit: 500,
      category: LEGACY_ALL_CATEGORIES,
      showKpis: true,
      showTrend: true,
      showBreakdown: true,
      columns: 4,
    }),
  }),
});

/** Supplies the previous version's defaults for release migration without changing stored props. */
export function readLegacyComponentDefaults(
  type: string,
  version: number,
): Readonly<Record<string, unknown>> | null {
  if (type === 'section' && version === 1) {
    return LEGACY_SECTION_DEFAULTS;
  }
  if (type === 'quickLinks' && version === 1) {
    return LEGACY_QUICK_LINKS_DEFAULTS;
  }
  if (type === 'wasteCalendar' && version === 1) {
    return LEGACY_WASTE_CALENDAR_DEFAULTS;
  }
  if (!hasOwnKey(LEGACY_COMPONENT_DEFAULTS, type)) {
    return null;
  }
  const previous = LEGACY_COMPONENT_DEFAULTS[type];
  return previous.version === version ? previous.props : null;
}

/** Removes only the old unfiltered-category sentinel; named taxonomies and other props survive. */
export function migrateCategoryProps(type: string, raw: unknown): unknown {
  if (!hasOwnKey(LEGACY_COMPONENT_DEFAULTS, type) || !isPlainObject(raw)) {
    return raw;
  }
  return raw['category'] === LEGACY_ALL_CATEGORIES || raw['category'] === ''
    ? omit(raw, ['category'])
    : raw;
}
