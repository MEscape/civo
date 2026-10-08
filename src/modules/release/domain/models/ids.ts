import { createIdParser } from '@lib/result';
import type { Brand } from '@lib/utils';

import { RELEASE_VALIDATION_CODES, fieldValidationFailed } from '../errors/release-errors';

/** Opaque identity of a release. */
export type ReleaseId = Brand<string, 'ReleaseId'>;

/**
 * The release module's own brand for a website's identity. The website
 * module's `WebsiteId` is never imported, so the two modules share no types.
 */
export type WebsiteId = Brand<string, 'WebsiteId'>;

/** Opaque identity of a migration. */
export type MigrationId = Brand<string, 'MigrationId'>;

/**
 * The release module's own brand for a builder page. Like `WebsiteId`, the
 * builder's own `PageId` is never imported.
 */
export type PageId = Brand<string, 'PageId'>;

export const RELEASE_ID_MAX_LENGTH = 128;
export const WEBSITE_ID_MAX_LENGTH = 128;
export const MIGRATION_ID_MAX_LENGTH = 128;
export const PAGE_ID_MAX_LENGTH = 128;

function hasValidLength(raw: string, max: number): boolean {
  return raw.length > 0 && raw.length <= max;
}

/**
 * Brands an id read from storage. Only infrastructure adapters call this;
 * request values go through `parseReleaseId`.
 */
export function toReleaseId(raw: string): ReleaseId {
  return raw as ReleaseId; // Brand constructor: the cast is only permitted here.
}

/** Brands a website id read from storage or from another module's adapter. */
export function toWebsiteId(raw: string): WebsiteId {
  return raw as WebsiteId; // Brand constructor: the cast is only permitted here.
}

/** Brands a migration id read from storage. */
export function toMigrationId(raw: string): MigrationId {
  return raw as MigrationId; // Brand constructor: the cast is only permitted here.
}

/** Brands a page id read from another module's adapter. */
export function toPageId(raw: string): PageId {
  return raw as PageId; // Brand constructor: the cast is only permitted here.
}

/** Brands a release id that arrived from a request, after checking its shape. */
export const parseReleaseId = createIdParser({
  isValid: (raw: string) => hasValidLength(raw, RELEASE_ID_MAX_LENGTH),
  brand: toReleaseId,
  mapError: () => fieldValidationFailed('releaseId', RELEASE_VALIDATION_CODES.idInvalid),
});

/** Brands a website id that arrived from a request, after checking its shape. */
export const parseWebsiteId = createIdParser({
  isValid: (raw: string) => hasValidLength(raw, WEBSITE_ID_MAX_LENGTH),
  brand: toWebsiteId,
  mapError: () => fieldValidationFailed('websiteId', RELEASE_VALIDATION_CODES.idInvalid),
});

/** Brands a migration id that arrived from a request, after checking its shape. */
export const parseMigrationId = createIdParser({
  isValid: (raw: string) => hasValidLength(raw, MIGRATION_ID_MAX_LENGTH),
  brand: toMigrationId,
  mapError: () => fieldValidationFailed('migrationId', RELEASE_VALIDATION_CODES.idInvalid),
});

/** Brands a page id that arrived from a request, after checking its shape. */
export const parsePageId = createIdParser({
  isValid: (raw: string) => hasValidLength(raw, PAGE_ID_MAX_LENGTH),
  brand: toPageId,
  mapError: () => fieldValidationFailed('pageId', RELEASE_VALIDATION_CODES.idInvalid),
});
