import {
  conflictError,
  infrastructureError,
  notFoundError,
  unexpectedError,
  validationError,
  FieldErrorBag,
} from '@lib/errors';
import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  UnexpectedAppError,
  ValidationAppError,
} from '@lib/errors';

/**
 * Stable codes. Presentation maps these to translation keys (i18n.md);
 * nothing here is user-facing prose.
 *
 * `notFound` is deliberately the ONE outcome for "no such release" and
 * "release belongs to another website", and `websiteNotFound` the one for
 * "no such website" and "website belongs to another tenant": codes reach
 * the client, and a separate code would disclose that the id exists
 * elsewhere.
 *
 * The migration of a release's components lives in this module, so its
 * codes live here too: one table, one message map. A failure that already
 * has a code is never repeated for migrations (an unknown website is
 * `websiteNotFound`, a website without a live release `notPublished`,
 * another module failing `sourceFailed`): one meaning, one code. For the
 * same reason `migrationNotFound` is the ONE outcome for "no such
 * migration" and "migration belongs to another website".
 */
export const RELEASE_ERROR_CODES = {
  notFound: 'release.not_found',
  websiteNotFound: 'release.website_not_found',
  notPublished: 'release.not_published',
  notRestorable: 'release.not_restorable',
  numberConflict: 'release.number_conflict',
  validationFailed: 'release.validation_failed',
  publishBlocked: 'release.publish_blocked',
  persistenceFailed: 'release.persistence_failed',
  sourceFailed: 'release.source_failed',
  snapshotCorrupted: 'release.snapshot_corrupted',
  migrationNotFound: 'release.migration_not_found',
  migrationAlreadyApplied: 'release.migration_already_applied',
  migrationStale: 'release.migration_stale',
  migrationPlanCorrupted: 'release.migration_plan_corrupted',
} as const;

/** Field-level codes, carried in `fieldErrors`. Also stable, also never prose. */
export const RELEASE_VALIDATION_CODES = {
  idInvalid: 'release.validation.id_invalid',
  noPages: 'release.validation.no_pages',
  pageConfigMissing: 'release.validation.page_config_missing',
  pageConfigInvalid: 'release.validation.page_config_invalid',
  contractIncompatible: 'release.validation.contract_incompatible',
  resolutionPageUnknown: 'release.validation.resolution_page_unknown',
  resolutionNodeUnknown: 'release.validation.resolution_node_unknown',
  resolutionFieldUnknown: 'release.validation.resolution_field_unknown',
  resolutionActionInvalid: 'release.validation.resolution_action_invalid',
  resolutionValueInvalid: 'release.validation.resolution_value_invalid',
} as const;

export type ReleaseErrorCode = (typeof RELEASE_ERROR_CODES)[keyof typeof RELEASE_ERROR_CODES];
export type ReleaseValidationCode =
  (typeof RELEASE_VALIDATION_CODES)[keyof typeof RELEASE_VALIDATION_CODES];
export type ReleaseCode = ReleaseErrorCode | ReleaseValidationCode;

/** Also covers another website's release: see `RELEASE_ERROR_CODES`. */
export function releaseNotFound(): NotFoundAppError {
  return notFoundError(RELEASE_ERROR_CODES.notFound, 'The release was not found.');
}

/** Also covers a foreign tenant's website: see `RELEASE_ERROR_CODES`. */
export function releaseWebsiteNotFound(): NotFoundAppError {
  return notFoundError(RELEASE_ERROR_CODES.websiteNotFound, 'The website was not found.');
}

/** The public site fails closed: it never falls back to draft content. */
export function releaseNotPublished(): NotFoundAppError {
  return notFoundError(RELEASE_ERROR_CODES.notPublished, 'The website has no published release.');
}

/** Only a release that was once fully built may go live again. */
export function releaseNotRestorable(): ConflictAppError {
  return conflictError(
    RELEASE_ERROR_CODES.notRestorable,
    'The release was never published successfully and cannot be restored.',
  );
}

/** Two publishes raced for the same release number; the loser may retry. */
export function releaseNumberConflict(): ConflictAppError {
  return conflictError(
    RELEASE_ERROR_CODES.numberConflict,
    'Another release was published at the same time.',
  );
}

export function releaseValidationFailed(fieldErrors: Record<string, string[]>): ValidationAppError {
  return validationError(
    RELEASE_ERROR_CODES.validationFailed,
    'The release input is invalid.',
    fieldErrors,
  );
}

export function fieldValidationFailed(
  field: string,
  code: ReleaseValidationCode,
): ValidationAppError {
  return releaseValidationFailed({ [field]: [code] });
}

/** Collects every invalid field of one input in a single pass. */
export function createReleaseValidationBag(): FieldErrorBag {
  return new FieldErrorBag(releaseValidationFailed);
}

/** The website cannot be published as it is; `fieldErrors` names every offending page. */
export function releasePublishBlocked(fieldErrors: Record<string, string[]>): ValidationAppError {
  return validationError(
    RELEASE_ERROR_CODES.publishBlocked,
    'The website cannot be published.',
    fieldErrors,
  );
}

export function createReleasePublishBlockedBag(): FieldErrorBag {
  return new FieldErrorBag(releasePublishBlocked);
}

/** Another module (website, builder) failed while the release input was gathered. */
export function releaseSourceFailed(cause: unknown): InfrastructureAppError {
  return infrastructureError(
    RELEASE_ERROR_CODES.sourceFailed,
    'The release input could not be loaded.',
    cause,
  );
}

/**
 * A stored snapshot no longer matches its schema: data corruption, or a
 * `schemaVersion` this build does not understand. Never partially render it.
 */
export function releaseSnapshotCorrupted(cause: unknown): UnexpectedAppError {
  return unexpectedError(
    RELEASE_ERROR_CODES.snapshotCorrupted,
    'The stored release snapshot is invalid.',
    cause,
  );
}

/** Also covers another website's migration: see `RELEASE_ERROR_CODES`. */
export function releaseMigrationNotFound(): NotFoundAppError {
  return notFoundError(RELEASE_ERROR_CODES.migrationNotFound, 'The migration was not found.');
}

/** A reviewed plan is applied once; applying it again would write its drafts a second time. */
export function releaseMigrationAlreadyApplied(): ConflictAppError {
  return conflictError(
    RELEASE_ERROR_CODES.migrationAlreadyApplied,
    'The migration was already applied.',
  );
}

/**
 * The plan was computed from a release that is no longer live. What the
 * reviewer saw no longer describes the website, so it is refused rather
 * than applied to something else.
 */
export function releaseMigrationStale(): ConflictAppError {
  return conflictError(
    RELEASE_ERROR_CODES.migrationStale,
    'The website was published again after this migration was proposed.',
  );
}

/**
 * A stored plan no longer matches its stored format: data corruption, or a
 * `schemaVersion` this build does not understand. Never apply it partially.
 */
export function releaseMigrationPlanCorrupted(cause: unknown): UnexpectedAppError {
  return unexpectedError(
    RELEASE_ERROR_CODES.migrationPlanCorrupted,
    'The stored migration plan is invalid.',
    cause,
  );
}
