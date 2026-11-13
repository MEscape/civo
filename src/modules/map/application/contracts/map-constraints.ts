/**
 * Domain vocabulary that presentation and the module's public API need
 * (types, the palette size, pure functions over the map model), re-exported
 * here so each is defined exactly once.
 */
export { MAP_VALIDATION_CODES } from '../../domain/errors/map-errors';
export { MAP_ERROR_CODES } from '../../domain/errors/map-errors';
export type { MapErrorCode } from '../../domain/errors/map-errors';
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
export { padViewport } from '../../domain/geo/viewport';
export { DEFAULT_MAP_BOUNDS } from '../../domain/geo/viewport';
export { boundsForLocations } from '../../domain/geo/location-bounds';
export { MAP_LIMITS, MAP_LIST_LIMITS, MAP_VIEWPORT_LIMITS } from '../map-limits';
export { GEO_LIMITS } from '../../domain/geo/geometry';
export { parseWebsiteId } from '../../domain/models/ids';
export { MAX_INLINE_MAP_TOKEN_LENGTH } from '../../domain/ports/inline-map-token.port';
export type { Bounds, GeoGeometry, GeometryFamily, Position } from '../../domain/geo/geometry';
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
export { EXTERNAL_MAP_ID_MAX_LENGTH } from '../../domain/models/ids';
