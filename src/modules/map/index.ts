/**
 * Server-side public API of the map module: a renderer of located records
 * that hosts already loaded. Other modules and framework entry points import
 * from here and nowhere deeper. This file reaches server-only code through
 * `composition.ts` and must never end up in a client bundle.
 */
export { MapSection } from './composition';

export { MAP_VALIDATION_CODES } from './application/contracts/map-constraints';

export { default as enMap } from './presentation/i18n/en.json';
export { default as deMap } from './presentation/i18n/de.json';

export type { MapSectionProps } from './presentation/components/map-section';
export type {
  Attributes,
  MapConfig,
  MapFeatureInput,
  MapLayerInput,
} from './application/contracts/map-constraints';
