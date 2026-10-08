import type { MapValidationCode } from '../errors/map-errors';
import type { Bounds, GeoGeometry, GeometryFamily } from '../geo/geometry';

export type AttributeValue = string | number | boolean;
export type Attributes = Readonly<Record<string, AttributeValue>>;

/**
 * One located record as the host hands it over. Untrusted: the geometry is
 * `unknown` on purpose, because the map decides what it can draw.
 * Properties of the record beyond its location (status, category, a
 * measurement, a timestamp) arrive flat in `attributes`; the map does not
 * know any of their names in advance.
 */
export interface MapFeatureInput {
  readonly id: string;
  readonly label: string;
  /** A GeoJSON geometry. Takes precedence over `latitude`/`longitude`. */
  readonly geometry?: unknown;
  readonly latitude?: number | undefined;
  readonly longitude?: number | undefined;
  readonly attributes: Attributes;
  readonly description?: string | undefined;
  readonly href?: string | undefined;
}

/** One dataset, rendered as one layer. */
export interface MapLayerInput {
  readonly id: string;
  readonly label: string;
  readonly features: readonly MapFeatureInput[];
}

export interface MapFeature {
  /** Unique across layers: `<layerId>:<featureId>`. */
  readonly key: string;
  readonly label: string;
  readonly geometry: GeoGeometry;
  readonly family: GeometryFamily;
  readonly attributes: Attributes;
  readonly description?: string;
  readonly href?: string;
}

/** What the data says about one attribute, found by looking at its values once. */
export type FieldKind = 'text' | 'number' | 'boolean' | 'date';

export interface FieldProfile {
  readonly key: string;
  readonly type: FieldKind;
  /**
   * Text and boolean fields: every distinct value with its frequency,
   * most frequent first. `null` when there are too many to enumerate, which
   * also means the field is not suited to categories or filters.
   */
  readonly distinct: ReadonlyArray<{ readonly value: string; readonly count: number }> | null;
  /** Number fields: numbers. Date fields: ISO date strings. */
  readonly min?: number | string;
  readonly max?: number | string;
}

export interface MapLayer {
  readonly id: string;
  readonly label: string;
  readonly features: readonly MapFeature[];
  readonly fields: readonly FieldProfile[];
  readonly bounds: Bounds | null;
}

export type FeatureIssue = MapValidationCode;

/** What was left out and why, so partial data is observable instead of silent. */
export interface DataIssues {
  readonly received: number;
  readonly dropped: number;
  readonly byReason: Readonly<Partial<Record<FeatureIssue, number>>>;
}
