import {
  conflictError,
  infrastructureError,
  notFoundError,
  rateLimitedError,
  validationError,
  FieldErrorBag,
} from '@lib/errors';
import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  RateLimitedAppError,
  ValidationAppError,
} from '@lib/errors';
import type { RateLimitFailure } from '@lib/rate-limit';

/**
 * Stable codes. Presentation maps these to translation keys; nothing here is user-facing prose.
 *
 * `notFound` is the ONE outcome for "no such file" and "a file of another website": a separate
 * code would disclose that the id exists elsewhere.
 */
export const MEDIA_ERROR_CODES = {
  notFound: 'media.not_found',
  validationFailed: 'media.validation_failed',
  persistenceFailed: 'media.persistence_failed',
  /** `STORAGE_PROVIDER=none`, or no bucket for the requested visibility. */
  storageDisabled: 'media.storage_disabled',
  /** The object store failed or refused. */
  storageFailed: 'media.storage_failed',
  tooManyPending: 'media.too_many_pending',
  /** Finalising before the file arrived: the client may upload and finalise again. */
  uploadMissing: 'media.upload_missing',
  /** The stored object is not what was announced; it was removed. */
  uploadRejected: 'media.upload_rejected',
  inUse: 'media.in_use',
  notPrivate: 'media.not_private',
  notReady: 'media.not_ready',
  rateLimited: 'media.rate_limited',
  rateLimiterFailed: 'media.rate_limiter_failed',
} as const;

/** Field-level codes, carried in `fieldErrors`. Also stable, also never prose. */
export const MEDIA_VALIDATION_CODES = {
  websiteInvalid: 'media.validation.website_invalid',
  idInvalid: 'media.validation.id_invalid',
  fileNameInvalid: 'media.validation.file_name_invalid',
  contentTypeUnsupported: 'media.validation.content_type_unsupported',
  sizeInvalid: 'media.validation.size_invalid',
  sizeTooLarge: 'media.validation.size_too_large',
  visibilityUnsupported: 'media.validation.visibility_unsupported',
} as const;

type MediaErrorCode = (typeof MEDIA_ERROR_CODES)[keyof typeof MEDIA_ERROR_CODES];
type MediaValidationCode = (typeof MEDIA_VALIDATION_CODES)[keyof typeof MEDIA_VALIDATION_CODES];
export type MediaCode = MediaErrorCode | MediaValidationCode;

/** Also covers another website's file: see `MEDIA_ERROR_CODES`. */
export function mediaNotFound(): NotFoundAppError {
  return notFoundError(MEDIA_ERROR_CODES.notFound, 'The file was not found.');
}

function mediaValidationFailed(fieldErrors: Record<string, string[]>): ValidationAppError {
  return validationError(MEDIA_ERROR_CODES.validationFailed, 'The file is invalid.', fieldErrors);
}

export function createMediaErrorBag(): FieldErrorBag {
  return new FieldErrorBag(mediaValidationFailed);
}

export function fieldValidationFailed(
  field: string,
  code: MediaValidationCode,
): ValidationAppError {
  return mediaValidationFailed({ [field]: [code] });
}

export function mediaStorageDisabled(): InfrastructureAppError {
  return infrastructureError(MEDIA_ERROR_CODES.storageDisabled, 'File storage is not set up.');
}

/** The store's own error is kept as the cause: it never carries a URL or a credential. */
export function mediaStorageFailed(cause: unknown): InfrastructureAppError {
  return infrastructureError(MEDIA_ERROR_CODES.storageFailed, 'The file storage failed.', cause);
}

export function mediaTooManyPending(): ConflictAppError {
  return conflictError(MEDIA_ERROR_CODES.tooManyPending, 'Too many uploads are waiting to finish.');
}

export function mediaUploadMissing(): ConflictAppError {
  return conflictError(MEDIA_ERROR_CODES.uploadMissing, 'The file has not been uploaded yet.');
}

export function mediaUploadRejected(): ValidationAppError {
  return validationError(
    MEDIA_ERROR_CODES.uploadRejected,
    'The uploaded file is not what was announced.',
    {},
  );
}

export function mediaInUse(): ConflictAppError {
  return conflictError(MEDIA_ERROR_CODES.inUse, 'The file is still used by the website.');
}

export function mediaNotPrivate(): ConflictAppError {
  return conflictError(MEDIA_ERROR_CODES.notPrivate, 'Only private files have a signed link.');
}

export function mediaNotReady(): ConflictAppError {
  return conflictError(MEDIA_ERROR_CODES.notReady, 'The file is not ready yet.');
}

/** The same person asked for too much in a short time. */
function rateLimited(retryAfterSeconds: number): RateLimitedAppError {
  return rateLimitedError(
    MEDIA_ERROR_CODES.rateLimited,
    'Too many requests. Please wait a moment and try again.',
    retryAfterSeconds,
  );
}

/** A refusal of the shared limiter, in this module's own codes, so its message table stays complete. */
export function fromRateLimitFailure(
  failure: RateLimitFailure,
): RateLimitedAppError | InfrastructureAppError {
  return failure.kind === 'rate_limited'
    ? rateLimited(failure.retryAfterSeconds)
    : infrastructureError(
        MEDIA_ERROR_CODES.rateLimiterFailed,
        'The request limit could not be checked.',
        failure.cause,
      );
}
