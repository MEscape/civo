import {
  conflictError,
  infrastructureError,
  notFoundError,
  rateLimitedError,
  unexpectedError,
  validationError,
  FieldErrorBag,
} from '@lib/errors';
import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  RateLimitedAppError,
  UnexpectedAppError,
  ValidationAppError,
} from '@lib/errors';
import type { RateLimitFailure } from '@lib/rate-limit';

/**
 * Stable codes. Presentation maps these to translation keys (i18n.md);
 * nothing here is user-facing prose.
 *
 * `notFound` is deliberately the ONE outcome for "no such website" and
 * "website belongs to another tenant": codes reach the client, and a
 * separate code would disclose that the id exists elsewhere.
 */
export const WEBSITE_ERROR_CODES = {
  notFound: 'website.not_found',
  slugTaken: 'website.slug_taken',
  validationFailed: 'website.validation_failed',
  persistenceFailed: 'website.persistence_failed',
  homePageProvisioningFailed: 'website.home_page_provisioning_failed',
  homePageBlueprintRejected: 'website.home_page_blueprint_rejected',
  rateLimited: 'website.rate_limited',
  rateLimiterFailed: 'website.rate_limiter_failed',
} as const;

/** Field-level codes, carried in `fieldErrors`. Also stable, also never prose. */
export const WEBSITE_VALIDATION_CODES = {
  idInvalid: 'website.validation.id_invalid',
  nameTooShort: 'website.validation.name_too_short',
  nameTooLong: 'website.validation.name_too_long',
  slugRequired: 'website.validation.slug_required',
  slugTooLong: 'website.validation.slug_too_long',
  slugInvalid: 'website.validation.slug_invalid',
  descriptionTooLong: 'website.validation.description_too_long',
  templateUnknown: 'website.validation.template_unknown',
  colorInvalid: 'website.validation.color_invalid',
  fontUnsupported: 'website.validation.font_unsupported',
  radiusUnsupported: 'website.validation.radius_unsupported',
  spacingUnsupported: 'website.validation.spacing_unsupported',
} as const;

export type WebsiteErrorCode = (typeof WEBSITE_ERROR_CODES)[keyof typeof WEBSITE_ERROR_CODES];
export type WebsiteValidationCode =
  (typeof WEBSITE_VALIDATION_CODES)[keyof typeof WEBSITE_VALIDATION_CODES];
export type WebsiteCode = WebsiteErrorCode | WebsiteValidationCode;

/** Also covers a foreign tenant's website: see `WEBSITE_ERROR_CODES`. */
export function websiteNotFound(): NotFoundAppError {
  return notFoundError(WEBSITE_ERROR_CODES.notFound, 'The website was not found.');
}

/** Slugs are globally unique because they become public URL segments. */
export function websiteSlugTaken(): ConflictAppError {
  return conflictError(WEBSITE_ERROR_CODES.slugTaken, 'A website with this slug already exists.');
}

export function websiteValidationFailed(fieldErrors: Record<string, string[]>): ValidationAppError {
  return validationError(
    WEBSITE_ERROR_CODES.validationFailed,
    'The website input is invalid.',
    fieldErrors,
  );
}

/** One place wires the bag to this module's error factory. */
export function createWebsiteErrorBag(): FieldErrorBag {
  return new FieldErrorBag(websiteValidationFailed);
}

/** A validation failure on a single field. */
export function fieldValidationFailed(
  field: string,
  code: WebsiteValidationCode,
): ValidationAppError {
  return websiteValidationFailed({ [field]: [code] });
}

/** The builder was unreachable or failed while creating the home page. */
export function homePageProvisioningFailed(cause: unknown): InfrastructureAppError {
  return infrastructureError(
    WEBSITE_ERROR_CODES.homePageProvisioningFailed,
    'The home page could not be provisioned.',
    cause,
  );
}

/**
 * The builder rejected a blueprint we generated. That is a bug in a
 * template, not bad user input, so it is `unexpected`.
 */
export function homePageBlueprintRejected(cause: unknown): UnexpectedAppError {
  return unexpectedError(
    WEBSITE_ERROR_CODES.homePageBlueprintRejected,
    'The builder rejected the home page blueprint.',
    cause,
  );
}

/** The same person asked for too much in a short time. */
function rateLimited(retryAfterSeconds: number): RateLimitedAppError {
  return rateLimitedError(
    WEBSITE_ERROR_CODES.rateLimited,
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
        WEBSITE_ERROR_CODES.rateLimiterFailed,
        'The request limit could not be checked.',
        failure.cause,
      );
}
