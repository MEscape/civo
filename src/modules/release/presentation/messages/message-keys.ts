import type { MessageCatalog } from '@i18n';

import { fieldPath } from '@lib/errors/validation';
import type { NestedKeyOf } from '@lib/errors/validation';
import type { SerializedActionError } from '@lib/result';

import {
  RELEASE_ERROR_CODES as ERRORS,
  RELEASE_VALIDATION_CODES as VALIDATION,
} from '../../application/contracts/release-constraints';

import type {
  MigrationStatus,
  NodeMigrationStatus,
  PageOutcome,
  ReleaseCode,
  ReleaseStatus,
  UnresolvableReason,
} from '../../application/contracts/release-constraints';

type ValidKeys = NestedKeyOf<MessageCatalog['release']>;

/**
 * Codes -> translation keys, relative to the `release` namespace.
 * `satisfies Record<ReleaseCode, ...>` makes a new code fail to compile
 * until it has a message.
 */
export const MESSAGE_KEY_BY_CODE = {
  [ERRORS.notFound]: fieldPath('errors', 'notFound'),
  [ERRORS.websiteNotFound]: fieldPath('errors', 'websiteNotFound'),
  [ERRORS.notPublished]: fieldPath('errors', 'notPublished'),
  [ERRORS.notRestorable]: fieldPath('errors', 'notRestorable'),
  [ERRORS.numberConflict]: fieldPath('errors', 'numberConflict'),
  [ERRORS.validationFailed]: fieldPath('errors', 'validationFailed'),
  [ERRORS.publishBlocked]: fieldPath('errors', 'publishBlocked'),
  [ERRORS.persistenceFailed]: fieldPath('errors', 'persistenceFailed'),
  [ERRORS.sourceFailed]: fieldPath('errors', 'persistenceFailed'),
  [ERRORS.snapshotCorrupted]: fieldPath('errors', 'snapshotCorrupted'),
  [ERRORS.migrationNotFound]: fieldPath('errors', 'migrationNotFound'),
  [ERRORS.migrationAlreadyApplied]: fieldPath('errors', 'migrationAlreadyApplied'),
  [ERRORS.migrationStale]: fieldPath('errors', 'migrationStale'),
  [ERRORS.migrationPlanCorrupted]: fieldPath('errors', 'snapshotCorrupted'),
  [VALIDATION.idInvalid]: fieldPath('validation', 'idInvalid'),
  [VALIDATION.noPages]: fieldPath('validation', 'noPages'),
  [VALIDATION.pageConfigMissing]: fieldPath('validation', 'pageConfigMissing'),
  [VALIDATION.pageConfigInvalid]: fieldPath('validation', 'pageConfigInvalid'),
  [VALIDATION.contractIncompatible]: fieldPath('validation', 'contractIncompatible'),
  [VALIDATION.resolutionPageUnknown]: fieldPath('validation', 'resolutionUnknown'),
  [VALIDATION.resolutionNodeUnknown]: fieldPath('validation', 'resolutionUnknown'),
  [VALIDATION.resolutionFieldUnknown]: fieldPath('validation', 'resolutionUnknown'),
  [VALIDATION.resolutionActionInvalid]: fieldPath('validation', 'resolutionActionInvalid'),
  [VALIDATION.resolutionValueInvalid]: fieldPath('validation', 'resolutionValueInvalid'),
} as const satisfies Record<ReleaseCode, ValidKeys>;

export const GENERIC_ERROR_MESSAGE_KEY = fieldPath('errors', 'unexpected');

export type MessageKey =
  (typeof MESSAGE_KEY_BY_CODE)[ReleaseCode] | typeof GENERIC_ERROR_MESSAGE_KEY;

function isReleaseCode(code: string): code is ReleaseCode {
  return Object.hasOwn(MESSAGE_KEY_BY_CODE, code);
}

/**
 * Codes from other modules (authorization, for instance) or from Zod's own
 * structural messages are unknown here and get the generic message.
 */
export function messageKeyForCode(code: string): MessageKey {
  return isReleaseCode(code) ? MESSAGE_KEY_BY_CODE[code] : GENERIC_ERROR_MESSAGE_KEY;
}

/**
 * The message for a failed action that has no form fields to put errors
 * on: the first field error's code if there is one (it is the most
 * specific), else the error's own.
 */
export function messageKeyForError(error: SerializedActionError): MessageKey {
  const [firstCodes] = Object.values(error.fieldErrors ?? {});
  return messageKeyForCode(firstCodes?.[0] ?? error.code);
}

export const STATUS_MESSAGE_KEYS = {
  draft: fieldPath('status', 'draft'),
  published: fieldPath('status', 'published'),
  rolled_back: fieldPath('status', 'rolledBack'),
  failed: fieldPath('status', 'failed'),
} as const satisfies Record<ReleaseStatus, ValidKeys>;

export const NODE_STATUS_MESSAGE_KEYS = {
  unchanged: fieldPath('migration', 'nodeStatus', 'unchanged'),
  upgradable: fieldPath('migration', 'nodeStatus', 'upgradable'),
  needs_review: fieldPath('migration', 'nodeStatus', 'needsReview'),
  unresolvable: fieldPath('migration', 'nodeStatus', 'unresolvable'),
} as const satisfies Record<NodeMigrationStatus, ValidKeys>;

export const UNRESOLVABLE_REASON_MESSAGE_KEYS = {
  type_unregistered: fieldPath('migration', 'unresolvableReason', 'typeUnregistered'),
  version_unregistered: fieldPath('migration', 'unresolvableReason', 'versionUnregistered'),
} as const satisfies Record<UnresolvableReason, ValidKeys>;

export const PAGE_OUTCOME_MESSAGE_KEYS = {
  written: fieldPath('migration', 'outcome', 'written'),
  already_applied: fieldPath('migration', 'outcome', 'alreadyApplied'),
  draft_diverged: fieldPath('migration', 'outcome', 'draftDiverged'),
  page_missing: fieldPath('migration', 'outcome', 'pageMissing'),
  failed: fieldPath('migration', 'outcome', 'failed'),
} as const satisfies Record<PageOutcome, ValidKeys>;

export const MIGRATION_STATUS_MESSAGE_KEYS = {
  proposed: fieldPath('migration', 'status', 'proposed'),
  applied: fieldPath('migration', 'status', 'applied'),
} as const satisfies Record<MigrationStatus, ValidKeys>;
