/**
 * Domain constants and codes that presentation legitimately needs (schema
 * validation, message lookup). Presentation may not import the domain, so
 * they are re-exported here as part of the application's contract. Nothing
 * in this file is defined twice.
 */
export { RELEASE_ERROR_CODES, RELEASE_VALIDATION_CODES } from '../../domain/errors/release-errors';
export type { ReleaseCode } from '../../domain/errors/release-errors';
export { RELEASE_ID_MAX_LENGTH, WEBSITE_ID_MAX_LENGTH } from '../../domain/models/ids';
export { RELEASE_STATUSES } from '../../domain/models/release';
export type { ReleaseStatus } from '../../domain/models/release';
export { MIGRATION_ID_MAX_LENGTH } from '../../domain/models/ids';
export {
  CUSTOM_VALUE_LIMITS,
  RESOLUTION_ACTIONS,
  isAcceptableCustomValue,
} from '../../domain/models/conflict-resolution';
export type { ResolutionAction } from '../../domain/models/conflict-resolution';
export { MIGRATION_STATUSES } from '../../domain/models/migration';
export type { MigrationStatus } from '../../domain/models/migration';
export { NODE_MIGRATION_STATUSES, UNRESOLVABLE_REASONS } from '../../domain/models/migration-plan';
export type { NodeMigrationStatus, UnresolvableReason } from '../../domain/models/migration-plan';
export { PAGE_OUTCOMES } from '../../domain/models/page-draft';
export type { PageOutcome } from '../../domain/models/page-draft';
