/**
 * Server-side public API of the map module: a renderer of located records
 * that hosts already loaded. Other modules and framework entry points import
 * from here and nowhere deeper. This file reaches server-only code through
 * `composition.ts` and must never end up in a client bundle.
 */
export { MapSection } from './composition';
export {
  getMapQueries,
  deleteMapGuarded,
  listMapsForRelease,
  restorePublishedMaps,
} from './composition';
export type { StoredPublishedMap } from './application/contracts/saved-map-views';
export type {
  DeleteMapError,
  DeleteMapInput,
  MapDeletionGuard,
} from './application/commands/delete-map';
export { MapsAdministration } from './presentation/components/management/maps-administration';
export { MapEditor } from './presentation/components/editor/map-editor';
export { mapRoutes } from './presentation/routes';
export { invalidateMapScreens } from './presentation/cache/invalidate';
export type { SavedMapView } from './application/contracts/saved-map-views';

export { default as enMap } from './presentation/i18n/en.json';
export { default as deMap } from './presentation/i18n/de.json';

export type { MapSectionProps } from './presentation/components/shared/map-section';
export type {
  Attributes,
  MapFeatureInput,
  MapLayerInput,
} from './application/contracts/map-constraints';
export { MapsOverviewTile } from './presentation/components/management/maps-overview-tile';
