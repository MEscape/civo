import { literalGuard } from '@lib/utils';

/**
 * The stable contract between data integration and the website builder.
 * Component definitions declare which canonical kind they consume; the
 * dataset selector filters by it. A plain list in code (not a database
 * enum): adding a kind is a code change, with no migration.
 *
 * Lives in its own file (like `website-template.ts`) so that the dataset,
 * its mapping and the target-field table can all depend on it without
 * depending on each other.
 */
export const CANONICAL_KINDS = [
  'Event',
  'NewsItem',
  'Service',
  'Contact',
  'OpeningHoursEntry',
  'ServiceDetail',
  'CouncilBody',
  'WasteCollectionEntry',
  'Alert',
  'Department',
  'SmartCityMetric',
  'SmartCityGoal',
  'SmartCityObservation',
  'SmartCityBreakdownEntry',
  'GeoFeature',
] as const;

export type CanonicalKind = (typeof CANONICAL_KINDS)[number];

/** Narrows untrusted text (a stored row, a request value) to a known kind. */
export const isCanonicalKind = literalGuard(CANONICAL_KINDS);
