import type { PageLimits } from '@lib/pagination';

import { SAVED_MAP_LIMITS } from '../domain/models/saved-map';

/** Bounds the application applies to every map, whatever a request asks for. */
export const MAP_LIMITS = {
  maxLayers: SAVED_MAP_LIMITS.layers,
  maxFeatures: SAVED_MAP_LIMITS.maxFeatures,
  mapsPerWebsite: SAVED_MAP_LIMITS.mapsPerWebsite,
  optionsPageSize: 100,
} as const;

export const MAP_VIEWPORT_LIMITS = { padding: 0.15, debounceMs: 250 } as const;

/** The list of maps: one page shows a typical website's maps; the largest page holds all of them. */
export const MAP_LIST_LIMITS: PageLimits = {
  defaultPageSize: 25,
  maxPageSize: SAVED_MAP_LIMITS.mapsPerWebsite,
};
