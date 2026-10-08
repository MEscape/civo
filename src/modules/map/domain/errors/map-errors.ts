/**
 * Why a feature could not be placed on the map. These are not failures of
 * the map: an unusable feature is left out, counted and reported, and the
 * rest is drawn. The codes are stable; presentation maps them to text.
 */
export const MAP_VALIDATION_CODES = {
  geometryMissing: 'map.validation.geometry_missing',
  geometryUnsupported: 'map.validation.geometry_unsupported',
  geometryInvalid: 'map.validation.geometry_invalid',
  coordinatesOutOfRange: 'map.validation.coordinates_out_of_range',
  geometryTooLarge: 'map.validation.geometry_too_large',
  duplicateId: 'map.validation.duplicate_id',
} as const;

export type MapValidationCode = (typeof MAP_VALIDATION_CODES)[keyof typeof MAP_VALIDATION_CODES];
