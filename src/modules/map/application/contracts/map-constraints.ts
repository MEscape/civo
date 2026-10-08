/**
 * Domain vocabulary that presentation and the module's public API need
 * (types, the palette size, pure functions over the map model), re-exported
 * here so each is defined exactly once.
 */
export { MAP_VALIDATION_CODES } from '../../domain/errors/map-errors';
export type { MapValidationCode } from '../../domain/errors/map-errors';
export { isDateValue } from '../../domain/features/profile-fields';
export type {
  AttributeValue,
  Attributes,
  DataIssues,
  FieldProfile,
  MapFeature,
  MapFeatureInput,
  MapLayer,
  MapLayerInput,
} from '../../domain/features/map-features';
export { geometryBounds, mergeBounds } from '../../domain/geo/geometry';
export type { Bounds, GeometryFamily } from '../../domain/geo/geometry';
export { countActiveFilters, filterFeatures } from '../../domain/filters/filters';
export type {
  DateRangeFilter,
  FilterDefinition,
  FilterState,
  FilterValue,
  RangeFilter,
  SelectFilter,
} from '../../domain/filters/filters';
export type {
  FeatureInteraction,
  MapConfig,
  MapHeight,
  PointStyle,
} from '../../domain/models/map-config';
export { PALETTE_SIZE } from '../../domain/style/layer-style';
export type { ColorEncoding, LayerStyle } from '../../domain/style/layer-style';
