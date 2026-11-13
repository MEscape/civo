import { z } from 'zod';

import {
  GEO_LIMITS,
  EXTERNAL_MAP_ID_MAX_LENGTH,
  MAX_INLINE_MAP_TOKEN_LENGTH,
} from '../../application/contracts/map-constraints';
import { SAVED_MAP_LIMITS } from '../../application/contracts/saved-map-views';
import { safeContentHref } from '../hooks/content-href';

const INVALID_INPUT = 'map.invalid_input';
const LINK_INVALID = 'map.invalid_link';
const id = z.uuid();
const externalId = z.string().min(1).max(EXTERNAL_MAP_ID_MAX_LENGTH);
const label = z.string().trim().min(1).max(SAVED_MAP_LIMITS.label);

export const mapBoundsSchema = z
  .tuple([
    z.number().min(-GEO_LIMITS.longitude).max(GEO_LIMITS.longitude),
    z.number().min(-GEO_LIMITS.latitude).max(GEO_LIMITS.latitude),
    z.number().min(-GEO_LIMITS.longitude).max(GEO_LIMITS.longitude),
    z.number().min(-GEO_LIMITS.latitude).max(GEO_LIMITS.latitude),
  ])
  .refine(([west, south, east, north]) => west < east && south < north, 'map.invalid_bounds');

export const savedMapSettingsSchema = z
  .object({
    isPublic: z.boolean(),
    pointStyle: z.enum(['markers', 'circles', 'clusters', 'heatmap']),
    interaction: z.enum(['details', 'link', 'none']),
    height: z.enum(['compact', 'standard', 'tall']),
    colorBy: z.string().trim().max(SAVED_MAP_LIMITS.label).optional(),
    sizeBy: z.string().trim().max(SAVED_MAP_LIMITS.label).optional(),
    showFilters: z.boolean(),
    showLegend: z.boolean(),
    featureLimit: z.number().int().min(SAVED_MAP_LIMITS.layers).max(SAVED_MAP_LIMITS.maxFeatures),
    initialBounds: mapBoundsSchema,
    layers: z
      .array(z.object({ datasetId: externalId, label }))
      .max(SAVED_MAP_LIMITS.layers)
      .refine(
        (layers) => new Set(layers.map((layer) => layer.datasetId)).size === layers.length,
        'map.duplicate_dataset',
      ),
    locations: z
      .array(
        z.object({
          id: z.string().min(1).max(SAVED_MAP_LIMITS.label),
          label,
          longitude: z.number().min(-GEO_LIMITS.longitude).max(GEO_LIMITS.longitude),
          latitude: z.number().min(-GEO_LIMITS.latitude).max(GEO_LIMITS.latitude),
          description: z.string().trim().max(SAVED_MAP_LIMITS.locationDescription).optional(),
          href: z
            .string()
            .trim()
            .max(SAVED_MAP_LIMITS.locationHref)
            .refine((href) => href === '' || safeContentHref(href) !== null, LINK_INVALID)
            .optional(),
        }),
      )
      .max(SAVED_MAP_LIMITS.locations)
      .refine(
        (locations) => new Set(locations.map((location) => location.id)).size === locations.length,
        INVALID_INPUT,
      )
      .optional(),
  })
  .refine((settings) => settings.layers.length + (settings.locations?.length ?? 0) > 0, {
    message: INVALID_INPUT,
    path: ['layers'],
  })
  .refine(
    (settings) =>
      settings.layers.length + ((settings.locations?.length ?? 0) > 0 ? 1 : 0) <=
      SAVED_MAP_LIMITS.layers,
    { message: INVALID_INPUT, path: ['layers'] },
  )
  .refine(
    (settings) =>
      settings.featureLimit >= settings.layers.length + (settings.locations?.length ?? 0),
    {
      message: INVALID_INPUT,
      path: ['featureLimit'],
    },
  );

export const savedMapDraftSchema = z.object({
  name: z.string().trim().min(1).max(SAVED_MAP_LIMITS.name),
  description: z.string().trim().max(SAVED_MAP_LIMITS.description).nullable(),
  settings: savedMapSettingsSchema,
});

export const saveMapSchema = savedMapDraftSchema
  .extend({
    websiteId: externalId,
    id: id.optional(),
    version: z.number().int().positive().optional(),
  })
  .refine((value) => (value.id === undefined) === (value.version === undefined), INVALID_INPUT);

export const previewMapWindowSchema = z.object({
  websiteId: externalId,
  draft: savedMapDraftSchema,
  bounds: mapBoundsSchema,
});

export const mapOptionsSchema = z.object({ websiteId: externalId });

export const inlineMapWindowSchema = z.object({
  token: z.string().min(1).max(MAX_INLINE_MAP_TOKEN_LENGTH),
  bounds: mapBoundsSchema,
});

/** The map editor's form: a draft before the website and version are added. */
export type MapEditorValues = z.infer<typeof savedMapDraftSchema>;
