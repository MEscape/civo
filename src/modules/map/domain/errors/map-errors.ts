/**
 * Why a feature could not be placed on the map. These are not failures of
 * the map: an unusable feature is left out, counted and reported, and the
 * rest is drawn. The codes are stable; presentation maps them to text.
 */
import {
  conflictError,
  infrastructureError,
  notFoundError,
  rateLimitedError,
  validationError,
} from '@lib/errors';
import type { RateLimitFailure } from '@lib/rate-limit';

export const MAP_VALIDATION_CODES = {
  geometryMissing: 'map.validation.geometry_missing',
  geometryUnsupported: 'map.validation.geometry_unsupported',
  geometryInvalid: 'map.validation.geometry_invalid',
  coordinatesOutOfRange: 'map.validation.coordinates_out_of_range',
  geometryTooLarge: 'map.validation.geometry_too_large',
  duplicateId: 'map.validation.duplicate_id',
  recordInvalid: 'map.validation.record_invalid',
} as const;

export type MapValidationCode = (typeof MAP_VALIDATION_CODES)[keyof typeof MAP_VALIDATION_CODES];

export const MAP_ERROR_CODES = {
  invalidInput: 'map.invalid_input',
  notFound: 'map.not_found',
  versionConflict: 'map.version_conflict',
  limitReached: 'map.limit_reached',
  sourceFailed: 'map.source_failed',
  persistenceFailed: 'map.persistence_failed',
  rateLimited: 'map.rate_limited',
  limiterFailed: 'map.limiter_failed',
} as const;
export type MapErrorCode = (typeof MAP_ERROR_CODES)[keyof typeof MAP_ERROR_CODES];

export const mapInvalidInput = () =>
  validationError(MAP_ERROR_CODES.invalidInput, 'Check the map settings.', {});
export const mapNotFound = () => notFoundError(MAP_ERROR_CODES.notFound, 'Map not found.');
export const mapVersionConflict = () =>
  conflictError(MAP_ERROR_CODES.versionConflict, 'This map changed. Reload before saving.');
export const mapLimitReached = () =>
  conflictError(MAP_ERROR_CODES.limitReached, 'The website map limit has been reached.');
export const mapSourceFailed = (cause?: unknown) =>
  infrastructureError(MAP_ERROR_CODES.sourceFailed, 'Map data is temporarily unavailable.', cause);

export function fromRateLimitFailure(error: RateLimitFailure) {
  return error.kind === 'rate_limited'
    ? rateLimitedError(
        MAP_ERROR_CODES.rateLimited,
        'Too many map requests. Try again later.',
        error.retryAfterSeconds,
      )
    : infrastructureError(
        MAP_ERROR_CODES.limiterFailed,
        'Map requests are temporarily unavailable.',
        error,
      );
}
