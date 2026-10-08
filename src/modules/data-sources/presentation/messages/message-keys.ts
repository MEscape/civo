import type { MessageCatalog } from '@i18n';

import { fieldPath } from '@lib/errors/validation';
import type { NestedKeyOf } from '@lib/errors/validation';

import {
  DATA_SOURCE_ERROR_CODES as ERRORS,
  DATA_SOURCE_LIMITS,
  DATA_SOURCE_VALIDATION_CODES as VALIDATION,
  DATASET_LIMITS,
  MAPPING_LIMITS,
} from '../../application/contracts/data-source-constraints';

import type { AuthMode, DataSourceCode } from '../../application/contracts/data-source-constraints';
import type {
  CanonicalKind,
  DataSourceKind,
  DataSourceStatus,
} from '../../application/contracts/data-source-views';

type ValidKeys = NestedKeyOf<MessageCatalog['dataSources']>;

/**
 * Codes -> translation keys.
 * `satisfies Record<DataSourceCode, ...>` makes a new code fail to compile
 * until it has a message. Connection codes carry what the old four
 * "diagnostic categories" used to say as a prefix.
 */
export const MESSAGE_KEY_BY_CODE = {
  [ERRORS.dataSourceNotFound]: fieldPath('errors', 'dataSourceNotFound'),
  [ERRORS.websiteNotFound]: fieldPath('errors', 'websiteNotFound'),
  [ERRORS.datasetNotFound]: fieldPath('errors', 'datasetNotFound'),
  [ERRORS.datasetSlugTaken]: fieldPath('errors', 'datasetSlugTaken'),
  [ERRORS.datasetNotMapped]: fieldPath('errors', 'datasetNotMapped'),
  [ERRORS.validationFailed]: fieldPath('errors', 'validation'),
  [ERRORS.mappingFailed]: fieldPath('errors', 'mappingFailed'),
  [ERRORS.persistenceFailed]: fieldPath('errors', 'infrastructure'),
  [ERRORS.connectionFailed]: fieldPath('errors', 'connectionFailed'),
  [ERRORS.connectionTimedOut]: fieldPath('errors', 'connectionTimedOut'),
  [ERRORS.authenticationFailed]: fieldPath('errors', 'authenticationFailed'),
  [ERRORS.upstreamError]: fieldPath('errors', 'upstreamError'),
  [ERRORS.responseTooLarge]: fieldPath('errors', 'responseTooLarge'),
  [ERRORS.responseUnreadable]: fieldPath('errors', 'responseUnreadable'),
  [ERRORS.responseNotJson]: fieldPath('errors', 'responseNotJson'),
  [ERRORS.noSampleRecords]: fieldPath('errors', 'noSampleRecords'),
  [ERRORS.credentialsMissing]: fieldPath('errors', 'credentialsMissing'),
  [ERRORS.connectorUnavailable]: fieldPath('errors', 'connectorUnavailable'),
  [ERRORS.addressNotAllowed]: fieldPath('errors', 'addressNotAllowed'),
  [VALIDATION.idInvalid]: fieldPath('validation', 'idInvalid'),
  [VALIDATION.nameTooShort]: fieldPath('validation', 'nameTooShort'),
  [VALIDATION.nameTooLong]: fieldPath('validation', 'nameTooLong'),
  [VALIDATION.kindUnknown]: fieldPath('validation', 'kindUnknown'),
  [VALIDATION.configInvalid]: fieldPath('validation', 'configInvalid'),
  [VALIDATION.baseUrlInvalid]: fieldPath('validation', 'baseUrlInvalid'),
  [VALIDATION.urlSchemeNotAllowed]: fieldPath('validation', 'urlSchemeNotAllowed'),
  [VALIDATION.urlCredentialsNotAllowed]: fieldPath('validation', 'urlCredentialsNotAllowed'),
  [VALIDATION.urlAddressNotAllowed]: fieldPath('validation', 'urlAddressNotAllowed'),
  [VALIDATION.pathInvalid]: fieldPath('validation', 'pathInvalid'),
  [VALIDATION.authModeUnsupported]: fieldPath('validation', 'authModeUnsupported'),
  [VALIDATION.credentialsMissing]: fieldPath('errors', 'credentialsMissing'),
  [VALIDATION.connectorUnavailable]: fieldPath('errors', 'connectorUnavailable'),
  [VALIDATION.datasetNameTooShort]: fieldPath('validation', 'datasetNameTooShort'),
  [VALIDATION.datasetNameTooLong]: fieldPath('validation', 'datasetNameTooLong'),
  [VALIDATION.datasetSlugRequired]: fieldPath('validation', 'slugRequired'),
  [VALIDATION.datasetSlugTooLong]: fieldPath('validation', 'slugTooLong'),
  [VALIDATION.datasetSlugInvalid]: fieldPath('validation', 'slugInvalid'),
  [VALIDATION.canonicalKindUnknown]: fieldPath('validation', 'canonicalKindUnknown'),
  [VALIDATION.mappingFieldCountInvalid]: fieldPath('validation', 'mappingFieldCountInvalid'),
  [VALIDATION.sourcePathInvalid]: fieldPath('validation', 'sourcePathInvalid'),
  [VALIDATION.targetPathInvalid]: fieldPath('validation', 'targetPathInvalid'),
  [VALIDATION.targetPathUnknown]: fieldPath('validation', 'targetPathUnknown'),
  [VALIDATION.targetPathConflict]: fieldPath('validation', 'targetPathConflict'),
  [VALIDATION.requiredTargetMissing]: fieldPath('validation', 'requiredTargetMissing'),
  [VALIDATION.transformInvalid]: fieldPath('validation', 'transformInvalid'),
  [VALIDATION.valueNotText]: fieldPath('validation', 'valueNotText'),
  [VALIDATION.valueNotNumber]: fieldPath('validation', 'valueNotNumber'),
  [VALIDATION.valueNotBoolean]: fieldPath('validation', 'valueNotBoolean'),
  [VALIDATION.valueNotDate]: fieldPath('validation', 'valueNotDate'),
  [VALIDATION.valueNotUrl]: fieldPath('validation', 'valueNotUrl'),
  [VALIDATION.valueMissing]: fieldPath('validation', 'valueMissing'),
} as const satisfies Record<DataSourceCode, ValidKeys>;

export const GENERIC_ERROR_MESSAGE_KEY = fieldPath('errors', 'unexpected');

export type MessageKey =
  (typeof MESSAGE_KEY_BY_CODE)[DataSourceCode] | typeof GENERIC_ERROR_MESSAGE_KEY;

function isDataSourceCode(code: string): code is DataSourceCode {
  return Object.hasOwn(MESSAGE_KEY_BY_CODE, code);
}

/**
 * Codes from other modules (authorization, for instance) or from Zod's own
 * structural messages are unknown here and get the generic message.
 */
export function messageKeyForCode(code: string): MessageKey {
  return isDataSourceCode(code) ? MESSAGE_KEY_BY_CODE[code] : GENERIC_ERROR_MESSAGE_KEY;
}

/** Interpolation values for messages that mention a limit. */
export const MESSAGE_PARAMS = {
  nameMax: DATA_SOURCE_LIMITS.nameMax,
  datasetNameMax: DATASET_LIMITS.nameMax,
  slugMax: DATASET_LIMITS.slugMax,
  maxFields: MAPPING_LIMITS.maxFields,
} as const;

export const KIND_MESSAGE_KEYS = {
  REST: fieldPath('kinds', 'REST'),
  MOCK: fieldPath('kinds', 'MOCK'),
} as const satisfies Record<DataSourceKind, string>;

export const STATUS_MESSAGE_KEYS = {
  OK: fieldPath('status', 'OK'),
  ERROR: fieldPath('status', 'ERROR'),
  UNKNOWN: fieldPath('status', 'UNKNOWN'),
} as const satisfies Record<DataSourceStatus, string>;

export const AUTH_MODE_MESSAGE_KEYS = {
  NONE: fieldPath('authModes', 'NONE'),
  API_KEY: fieldPath('authModes', 'API_KEY'),
  BEARER_TOKEN: fieldPath('authModes', 'BEARER_TOKEN'),
} as const satisfies Record<AuthMode, string>;

export const CANONICAL_KIND_MESSAGE_KEYS = {
  Event: fieldPath('canonicalKinds', 'Event'),
  NewsItem: fieldPath('canonicalKinds', 'NewsItem'),
  Service: fieldPath('canonicalKinds', 'Service'),
  Contact: fieldPath('canonicalKinds', 'Contact'),
  OpeningHoursEntry: fieldPath('canonicalKinds', 'OpeningHoursEntry'),
  ServiceDetail: fieldPath('canonicalKinds', 'ServiceDetail'),
  CouncilBody: fieldPath('canonicalKinds', 'CouncilBody'),
  WasteCollectionEntry: fieldPath('canonicalKinds', 'WasteCollectionEntry'),
  Alert: fieldPath('canonicalKinds', 'Alert'),
  Department: fieldPath('canonicalKinds', 'Department'),
  SmartCityMetric: fieldPath('canonicalKinds', 'SmartCityMetric'),
  SmartCityGoal: fieldPath('canonicalKinds', 'SmartCityGoal'),
  SmartCityObservation: fieldPath('canonicalKinds', 'SmartCityObservation'),
  SmartCityBreakdownEntry: fieldPath('canonicalKinds', 'SmartCityBreakdownEntry'),
  GeoFeature: fieldPath('canonicalKinds', 'GeoFeature'),
} as const satisfies Record<CanonicalKind, string>;

/**
 * Target-field labels are keyed by canonical kind AND field path, which the
 * domain already lists in `CANONICAL_TARGET_FIELDS`. Repeating all of them
 * as a static table here would duplicate that list, so this is the one
 * deliberately constructed key; callers fall back to the raw path when a
 * label does not exist (as the old UI did for kinds it never labelled).
 */
export function targetFieldMessageKey(canonicalKind: CanonicalKind, path: string): string {
  return fieldPath('targetFields', canonicalKind, path);
}
