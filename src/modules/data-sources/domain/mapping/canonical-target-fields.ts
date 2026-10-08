import type { CanonicalKind } from '../models/canonical-kinds';

export interface CanonicalTargetField {
  readonly path: string;
  readonly required: boolean;
}

/**
 * Canonical target fields a mapping may fill, per canonical kind. The
 * domain owns which paths exist and which are required; display labels are
 * a presentation concern (translations).
 */
export const CANONICAL_TARGET_FIELDS: Readonly<
  Record<CanonicalKind, readonly CanonicalTargetField[]>
> = {
  Event: [
    { path: 'title', required: true },
    { path: 'description', required: false },
    { path: 'startDate', required: true },
    { path: 'endDate', required: false },
    { path: 'location', required: false },
    { path: 'category', required: false },
    { path: 'imageUrl', required: false },
  ],
  NewsItem: [
    { path: 'title', required: true },
    { path: 'slug', required: true },
    { path: 'excerpt', required: false },
    { path: 'content', required: false },
    { path: 'imageUrl', required: false },
    { path: 'publishedAt', required: false },
    { path: 'category', required: false },
  ],
  Service: [
    { path: 'title', required: true },
    { path: 'href', required: true },
    { path: 'description', required: false },
    { path: 'icon', required: false },
  ],
  Contact: [
    { path: 'name', required: true },
    { path: 'role', required: false },
    { path: 'email', required: false },
    { path: 'phone', required: false },
  ],
  Alert: [
    { path: 'title', required: true },
    { path: 'message', required: false },
    { path: 'severity', required: true },
    { path: 'active', required: true },
    { path: 'href', required: false },
  ],
  /** A current reading shown as a figure: a KPI card, a bar, a table row. */
  SmartCityMetric: [
    { path: 'label', required: true },
    { path: 'value', required: true },
    { path: 'unit', required: false },
    { path: 'category', required: false },
    { path: 'trend', required: false },
    { path: 'changePercent', required: false },
  ],
  /** A reading with the value it should reach: a gauge, current against target. */
  SmartCityGoal: [
    { path: 'label', required: true },
    { path: 'value', required: true },
    { path: 'target', required: true },
    { path: 'unit', required: false },
    { path: 'category', required: false },
  ],
  /** One point of a measurement over time; rows sharing a `series` form one line. */
  SmartCityObservation: [
    { path: 'series', required: true },
    { path: 'observedAt', required: true },
    { path: 'value', required: true },
    { path: 'unit', required: false },
    { path: 'category', required: false },
  ],
  /** One part of a whole; rows sharing a `group` form one distribution. */
  SmartCityBreakdownEntry: [
    { path: 'label', required: true },
    { path: 'value', required: true },
    { path: 'group', required: false },
    { path: 'unit', required: false },
  ],
  OpeningHoursEntry: [
    { path: 'dayOfWeek', required: true },
    { path: 'openTime', required: true },
    { path: 'closeTime', required: true },
  ],
  ServiceDetail: [
    { path: 'title', required: true },
    { path: 'description', required: false },
    { path: 'requirements', required: false },
    { path: 'costs', required: false },
    { path: 'href', required: false },
  ],
  CouncilBody: [
    { path: 'name', required: true },
    { path: 'role', required: false },
    { path: 'party', required: false },
    { path: 'imageUrl', required: false },
  ],
  WasteCollectionEntry: [
    { path: 'district', required: true },
    { path: 'wasteType', required: true },
    { path: 'collectionDate', required: true },
  ],
  Department: [
    { path: 'name', required: true },
    { path: 'description', required: false },
    { path: 'contact', required: false },
    { path: 'address', required: false },
  ],
  /**
   * A located thing for the map: a point (`latitude`/`longitude`) or any
   * GeoJSON `geometry`. `properties` takes a whole source object, so a
   * municipality's own fields (species, bikeCount, ...) stay available to
   * the map without this table listing them.
   */
  GeoFeature: [
    { path: 'name', required: true },
    { path: 'geometry', required: false },
    { path: 'latitude', required: false },
    { path: 'longitude', required: false },
    { path: 'category', required: false },
    { path: 'status', required: false },
    { path: 'value', required: false },
    { path: 'unit', required: false },
    { path: 'observedAt', required: false },
    { path: 'description', required: false },
    { path: 'href', required: false },
    { path: 'properties', required: false },
  ],
};
