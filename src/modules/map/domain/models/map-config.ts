/**
 * How the map is configured. Deliberately small: what to draw is decided by
 * the data, this only says how to present it.
 */
export const POINT_STYLES = ['markers', 'circles', 'clusters', 'heatmap'] as const;
export type PointStyle = (typeof POINT_STYLES)[number];

/** What a click on a feature does. */
export const FEATURE_INTERACTIONS = ['details', 'link', 'none'] as const;
export type FeatureInteraction = (typeof FEATURE_INTERACTIONS)[number];

export interface MapConfig {
  /** How point features are drawn. Lines and areas always draw as lines and areas. */
  readonly pointStyle: PointStyle;
  /** Attribute that drives colour. Empty: the map picks a fitting one (`status`, then `category`). */
  readonly colorBy?: string | undefined;
  /** Numeric attribute that drives size (circles) or intensity (heatmap). Empty: `value` if present. */
  readonly sizeBy?: string | undefined;
  readonly interaction: FeatureInteraction;
  readonly showFilters: boolean;
  readonly showLegend: boolean;
}

/** Fixed height steps instead of free pixel values, so the map fits every layout the same way. */
export const MAP_HEIGHTS = ['compact', 'standard', 'tall'] as const;
export type MapHeight = (typeof MAP_HEIGHTS)[number];
