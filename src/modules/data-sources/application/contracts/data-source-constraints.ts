/**
 * Domain constants and codes that presentation legitimately needs (form
 * validation, option lists, message lookup). Presentation may not import
 * the domain, so they are re-exported here as part of the application's
 * contract. Nothing in this file is defined twice.
 */
export { DEFAULT_REST_PATH } from '../../domain/config/rest-connection-config';
export {
  DATA_SOURCE_ERROR_CODES,
  DATA_SOURCE_VALIDATION_CODES,
} from '../../domain/errors/data-source-errors';
export type { DataSourceCode } from '../../domain/errors/data-source-errors';
export { CANONICAL_TARGET_FIELDS } from '../../domain/mapping/canonical-target-fields';
export type { CanonicalTargetField } from '../../domain/mapping/canonical-target-fields';
export {
  DEFAULT_JOIN_SEPARATOR,
  MAPPING_LIMITS,
  SIMPLE_TRANSFORM_KINDS,
} from '../../domain/mapping/dataset-mapping';
export type { SimpleTransformKind } from '../../domain/mapping/dataset-mapping';
export { CANONICAL_KINDS, type CanonicalKind } from '../../domain/models/canonical-kinds';
export { DATA_SOURCE_LIMITS } from '../../domain/models/data-source';
export {
  AUTH_MODES,
  DATA_SOURCE_KINDS,
  DATA_SOURCE_STATUSES,
} from '../../domain/models/data-source-kinds';
export type {
  AuthMode,
  DataSourceKind,
  DataSourceStatus,
} from '../../domain/models/data-source-kinds';
export { DATASET_LIMITS, DATASET_SLUG_PATTERN } from '../../domain/models/dataset';
export { DATA_SOURCE_ID_MAX_LENGTH } from '../../domain/models/ids';
