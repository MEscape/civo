import {
  FieldErrorBag,
  conflictError,
  forbiddenError,
  notFoundError,
  unexpectedError,
  validationError,
} from '@lib/errors';
import type {
  ConflictAppError,
  ForbiddenAppError,
  NotFoundAppError,
  UnexpectedAppError,
  ValidationAppError,
} from '@lib/errors';

/**
 * Stable codes. Presentation maps these to translation keys (i18n.md);
 * nothing here is user-facing prose.
 *
 * `pageNotFound` and `websiteNotFound` are deliberately also the outcome
 * for "belongs to another tenant": codes reach the client, and a separate
 * code would disclose that the id exists elsewhere.
 */
export const BUILDER_ERROR_CODES = {
  pageNotFound: 'builder.page_not_found',
  websiteNotFound: 'builder.website_not_found',
  nodeNotFound: 'builder.node_not_found',
  pagePathTaken: 'builder.page_path_taken',
  pageVersionConflict: 'builder.page_version_conflict',
  pageLimitExceeded: 'builder.page_limit_exceeded',
  validationFailed: 'builder.validation_failed',
  placementRejected: 'builder.placement_rejected',
  structureChangeNotPermitted: 'builder.structure_change_not_permitted',
  propChangeNotPermitted: 'builder.prop_change_not_permitted',
  pageConfigCorrupted: 'builder.page_config_corrupted',
  persistenceFailed: 'builder.persistence_failed',
} as const;

/** Field-level codes, carried in `fieldErrors`. Also stable, also never prose. */
export const BUILDER_VALIDATION_CODES = {
  idInvalid: 'builder.validation.id_invalid',
  idSeedInvalid: 'builder.validation.id_seed_invalid',
  idSeedReused: 'builder.validation.id_seed_reused',
  titleTooShort: 'builder.validation.title_too_short',
  titleTooLong: 'builder.validation.title_too_long',
  pathInvalid: 'builder.validation.path_invalid',
  pathTooLong: 'builder.validation.path_too_long',
  configInvalid: 'builder.validation.config_invalid',
  configTooLarge: 'builder.validation.config_too_large',
  nodeInvalid: 'builder.validation.node_invalid',
  nodeIdInvalid: 'builder.validation.node_id_invalid',
  nodeIdDuplicate: 'builder.validation.node_id_duplicate',
  nodeTypeInvalid: 'builder.validation.node_type_invalid',
  nodeTypeUnknown: 'builder.validation.node_type_unknown',
  nodePropsInvalid: 'builder.validation.node_props_invalid',
  nodeLimitExceeded: 'builder.validation.node_limit_exceeded',
  depthLimitExceeded: 'builder.validation.depth_limit_exceeded',
  nestingNotAllowed: 'builder.validation.nesting_not_allowed',
  placementInvalid: 'builder.validation.placement_invalid',
  versionInvalid: 'builder.validation.version_invalid',
} as const;

export type BuilderErrorCode = (typeof BUILDER_ERROR_CODES)[keyof typeof BUILDER_ERROR_CODES];
export type BuilderValidationCode =
  (typeof BUILDER_VALIDATION_CODES)[keyof typeof BUILDER_VALIDATION_CODES];
export type BuilderCode = BuilderErrorCode | BuilderValidationCode;

/** Also covers a foreign tenant's page: see `BUILDER_ERROR_CODES`. */
export function pageNotFound(): NotFoundAppError {
  return notFoundError(BUILDER_ERROR_CODES.pageNotFound, 'The page was not found.');
}

/** Also covers a foreign tenant's website: see `BUILDER_ERROR_CODES`. */
export function websiteNotFound(): NotFoundAppError {
  return notFoundError(BUILDER_ERROR_CODES.websiteNotFound, 'The website was not found.');
}

export function pageNodeNotFound(): NotFoundAppError {
  return notFoundError(BUILDER_ERROR_CODES.nodeNotFound, 'The node was not found.');
}

/** Paths are unique per website because they become public URL segments. */
export function pagePathTaken(): ConflictAppError {
  return conflictError(
    BUILDER_ERROR_CODES.pagePathTaken,
    'A page with this path already exists on this website.',
  );
}

/** Someone else saved a newer revision since this editor loaded the page. */
export function pageVersionConflict(): ConflictAppError {
  return conflictError(
    BUILDER_ERROR_CODES.pageVersionConflict,
    'The page was changed by someone else since it was loaded.',
  );
}

/** A website holds more pages than a bounded read may return; refusing beats silently truncating. */
export function pageLimitExceeded(): ConflictAppError {
  return conflictError(
    BUILDER_ERROR_CODES.pageLimitExceeded,
    'The website has more pages than can be processed at once.',
  );
}

export function builderValidationFailed(fieldErrors: Record<string, string[]>): ValidationAppError {
  return validationError(
    BUILDER_ERROR_CODES.validationFailed,
    'The builder input is invalid.',
    fieldErrors,
  );
}

/** One place wires the bag to this module's error factory. */
export function createBuilderErrorBag(): FieldErrorBag {
  return new FieldErrorBag(builderValidationFailed);
}

/** A validation failure on a single field. */
export function fieldValidationFailed(
  field: string,
  code: BuilderValidationCode,
): ValidationAppError {
  return builderValidationFailed({ [field]: [code] });
}

/** A tree operation the nesting rules or the tree structure refuse. */
export function placementRejected(): ValidationAppError {
  return validationError(
    BUILDER_ERROR_CODES.placementRejected,
    'The node cannot be placed there.',
    { placement: [BUILDER_VALIDATION_CODES.placementInvalid] },
  );
}

export function structureChangeNotPermitted(): ForbiddenAppError {
  return forbiddenError(
    BUILDER_ERROR_CODES.structureChangeNotPermitted,
    'This editor may not change the page structure.',
  );
}

export function propChangeNotPermitted(): ForbiddenAppError {
  return forbiddenError(
    BUILDER_ERROR_CODES.propChangeNotPermitted,
    'This editor may not change these properties.',
  );
}

/**
 * Stored JSON no longer satisfies the page invariants (edited outside the
 * app, or written by a future schema version). Reads fail closed with this
 * instead of crashing the renderer; it is a data bug, so `unexpected`.
 */
export function pageConfigCorrupted(cause: unknown): UnexpectedAppError {
  return unexpectedError(
    BUILDER_ERROR_CODES.pageConfigCorrupted,
    'The stored page configuration is invalid.',
    cause,
  );
}
