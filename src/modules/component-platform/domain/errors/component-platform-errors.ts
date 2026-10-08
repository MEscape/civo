import {
  FieldErrorBag,
  conflictError,
  infrastructureError,
  notFoundError,
  validationError,
} from '@lib/errors';
import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  ValidationAppError,
} from '@lib/errors';

/**
 * Stable codes; presentation maps them to translation keys. Nothing here is
 * user-facing prose.
 *
 * `datasetNotFound` covers "no such dataset", "malformed id" and "dataset of
 * another website" alike, so a code never reveals that an id exists
 * elsewhere.
 */
export const COMPONENT_PLATFORM_ERROR_CODES = {
  datasetNotFound: 'content.dataset_not_found',
  datasetNotMapped: 'content.dataset_not_mapped',
  datasetKindMismatch: 'content.dataset_kind_mismatch',
  sourceFailed: 'content.source_failed',
  recordInvalid: 'content.record_invalid',
  componentNotRegistered: 'component.not_registered',
} as const;

/** Reasons one field of a record or an id is rejected. Carried in `fieldErrors`, never shown as prose. */
export const COMPONENT_PLATFORM_VALIDATION_CODES = {
  idInvalid: 'content.validation.id_invalid',
  required: 'content.validation.required',
  tooLong: 'content.validation.too_long',
  tooShort: 'content.validation.too_short',
  tooMany: 'content.validation.too_many',
  typeInvalid: 'content.validation.type_invalid',
  outOfRange: 'content.validation.out_of_range',
  formatInvalid: 'content.validation.format_invalid',
  optionUnknown: 'content.validation.option_unknown',
  instantInvalid: 'content.validation.instant_invalid',
  urlUnsafe: 'content.validation.url_unsafe',
} as const;

export type ComponentPlatformErrorCode =
  (typeof COMPONENT_PLATFORM_ERROR_CODES)[keyof typeof COMPONENT_PLATFORM_ERROR_CODES];
export type ComponentPlatformValidationCode =
  (typeof COMPONENT_PLATFORM_VALIDATION_CODES)[keyof typeof COMPONENT_PLATFORM_VALIDATION_CODES];

export function contentDatasetNotFound(): NotFoundAppError {
  return notFoundError(
    COMPONENT_PLATFORM_ERROR_CODES.datasetNotFound,
    'The dataset was not found.',
  );
}

/** The dataset exists but has no field mapping yet: a setup state, not an outage. */
export function contentDatasetNotMapped(): ConflictAppError {
  return conflictError(
    COMPONENT_PLATFORM_ERROR_CODES.datasetNotMapped,
    'The dataset has no mapping yet.',
  );
}

/** The editor bound a dataset of one kind to a component that renders another. */
export function contentDatasetKindMismatch(): ConflictAppError {
  return conflictError(
    COMPONENT_PLATFORM_ERROR_CODES.datasetKindMismatch,
    'The dataset does not provide the content this component needs.',
  );
}

export function contentSourceFailed(cause: unknown): InfrastructureAppError {
  return infrastructureError(
    COMPONENT_PLATFORM_ERROR_CODES.sourceFailed,
    'The content could not be loaded.',
    cause,
  );
}

export function contentRecordInvalid(fieldErrors: Record<string, string[]>): ValidationAppError {
  return validationError(
    COMPONENT_PLATFORM_ERROR_CODES.recordInvalid,
    'The record does not satisfy its content contract.',
    fieldErrors,
  );
}

/** A validation failure on one named field, e.g. a malformed id. */
export function fieldValidationFailed(
  field: string,
  code: ComponentPlatformValidationCode,
): ValidationAppError {
  return contentRecordInvalid({ [field]: [code] });
}

/** The one place the shared bag is wired to this module's error factory. */
export function createContentErrorBag(): FieldErrorBag {
  return new FieldErrorBag(contentRecordInvalid);
}

/** The type is not registered; the caller decides whether that blocks. */
export function componentNotRegistered(): NotFoundAppError {
  return notFoundError(
    COMPONENT_PLATFORM_ERROR_CODES.componentNotRegistered,
    'The component is not registered.',
  );
}
