import {
  conflictError,
  infrastructureError,
  notFoundError,
  validationError,
  FieldErrorBag,
} from '@lib/errors';
import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  ValidationAppError,
} from '@lib/errors';
import { fieldPath } from '@lib/errors/validation';

/**
 * Stable codes. Presentation maps these to translation keys (i18n.md);
 * nothing here is user-facing prose.
 *
 * The connection codes replace the old four "diagnostic categories":
 * a code says more than a category did, and it is what the UI translates.
 * Two deliberate collapses protect against enumeration: "not found" covers
 * a missing record and another tenant's record alike, and upstream
 * details (HTTP status, response text) are logged, never returned.
 */
export const DATA_SOURCE_ERROR_CODES = {
  dataSourceNotFound: 'data_source.not_found',
  websiteNotFound: 'data_source.website_not_found',
  datasetNotFound: 'dataset.not_found',
  datasetSlugTaken: 'dataset.slug_taken',
  datasetNotMapped: 'dataset.not_mapped',
  validationFailed: 'data_source.validation_failed',
  mappingFailed: 'dataset.mapping_failed',
  persistenceFailed: 'data_source.persistence_failed',
  // Reaching the external system
  connectionFailed: 'data_source.connection_failed',
  connectionTimedOut: 'data_source.connection_timed_out',
  authenticationFailed: 'data_source.authentication_failed',
  upstreamError: 'data_source.upstream_error',
  responseTooLarge: 'data_source.response_too_large',
  responseUnreadable: 'data_source.response_unreadable',
  responseNotJson: 'data_source.response_not_json',
  noSampleRecords: 'data_source.no_sample_records',
  // The saved configuration cannot be used
  credentialsMissing: 'data_source.credentials_missing',
  connectorUnavailable: 'data_source.connector_unavailable',
  addressNotAllowed: 'data_source.address_not_allowed',
} as const;

/** Field-level codes, carried in `fieldErrors`. Also stable, also never prose. */
export const DATA_SOURCE_VALIDATION_CODES = {
  idInvalid: 'data_source.validation.id_invalid',
  nameTooShort: 'data_source.validation.name_too_short',
  nameTooLong: 'data_source.validation.name_too_long',
  kindUnknown: 'data_source.validation.kind_unknown',
  configInvalid: 'data_source.validation.config_invalid',
  baseUrlInvalid: 'data_source.validation.base_url_invalid',
  urlSchemeNotAllowed: 'data_source.validation.url_scheme_not_allowed',
  urlCredentialsNotAllowed: 'data_source.validation.url_credentials_not_allowed',
  urlAddressNotAllowed: 'data_source.validation.url_address_not_allowed',
  pathInvalid: 'data_source.validation.path_invalid',
  authModeUnsupported: 'data_source.validation.auth_mode_unsupported',
  credentialsMissing: 'data_source.validation.credentials_missing',
  connectorUnavailable: 'data_source.validation.connector_unavailable',
  datasetNameTooShort: 'dataset.validation.name_too_short',
  datasetNameTooLong: 'dataset.validation.name_too_long',
  datasetSlugRequired: 'dataset.validation.slug_required',
  datasetSlugTooLong: 'dataset.validation.slug_too_long',
  datasetSlugInvalid: 'dataset.validation.slug_invalid',
  canonicalKindUnknown: 'dataset.validation.canonical_kind_unknown',
  // Mapping definition
  mappingFieldCountInvalid: 'dataset.mapping.field_count_invalid',
  sourcePathInvalid: 'dataset.mapping.source_path_invalid',
  targetPathInvalid: 'dataset.mapping.target_path_invalid',
  targetPathUnknown: 'dataset.mapping.target_path_unknown',
  targetPathConflict: 'dataset.mapping.target_path_conflict',
  requiredTargetMissing: 'dataset.mapping.required_target_missing',
  transformInvalid: 'dataset.mapping.transform_invalid',
  // Applying a mapping to a record
  valueNotText: 'dataset.mapping.value_not_text',
  valueNotNumber: 'dataset.mapping.value_not_number',
  valueNotBoolean: 'dataset.mapping.value_not_boolean',
  valueNotDate: 'dataset.mapping.value_not_date',
  valueNotUrl: 'dataset.mapping.value_not_url',
  valueMissing: 'dataset.mapping.value_missing',
} as const;

export type DataSourceErrorCode =
  (typeof DATA_SOURCE_ERROR_CODES)[keyof typeof DATA_SOURCE_ERROR_CODES];
export type DataSourceValidationCode =
  (typeof DATA_SOURCE_VALIDATION_CODES)[keyof typeof DATA_SOURCE_VALIDATION_CODES];
export type DataSourceCode = DataSourceErrorCode | DataSourceValidationCode;

const CODES = DATA_SOURCE_ERROR_CODES;
const FIELD_CODES = DATA_SOURCE_VALIDATION_CODES;

/** Covers a foreign tenant's data source as well: see `DATA_SOURCE_ERROR_CODES`. */
export function dataSourceNotFound(): NotFoundAppError {
  return notFoundError(CODES.dataSourceNotFound, 'The data source was not found.');
}

/** Also covers a foreign tenant's dataset. */
export function datasetNotFound(): NotFoundAppError {
  return notFoundError(CODES.datasetNotFound, 'The dataset was not found.');
}

/** Raised when creating a source under a website the actor's tenant does not own. */
export function websiteNotFoundForDataSource(): NotFoundAppError {
  return notFoundError(CODES.websiteNotFound, 'The website was not found.');
}

export function datasetSlugTaken(): ConflictAppError {
  return conflictError(
    CODES.datasetSlugTaken,
    'A dataset with this slug already exists in the data source.',
  );
}

/** The dataset exists but has no usable mapping yet, so it cannot serve records. */
export function datasetNotMapped(): ConflictAppError {
  return conflictError(CODES.datasetNotMapped, 'The dataset has no field mapping.');
}

export function dataSourceValidationFailed(
  fieldErrors: Record<string, string[]>,
): ValidationAppError {
  return validationError(CODES.validationFailed, 'The data source input is invalid.', fieldErrors);
}

/** One place wires the bag to this module's error factory. */
export function createDataSourceErrorBag(): FieldErrorBag {
  return new FieldErrorBag(dataSourceValidationFailed);
}

/** A validation failure on a single field. */
export function fieldValidationFailed(
  field: string,
  code: DataSourceValidationCode,
): ValidationAppError {
  return dataSourceValidationFailed({ [field]: [code] });
}

/** A mapping could not be applied to a record: `fieldErrors` is keyed by target path. */
export function mappingFailed(fieldErrors: Record<string, string[]>): ValidationAppError {
  return validationError(
    CODES.mappingFailed,
    'The field mapping could not be applied.',
    fieldErrors,
  );
}

export function persistenceFailed(cause: unknown): InfrastructureAppError {
  return infrastructureError(CODES.persistenceFailed, 'Data source persistence failed.', cause);
}

export function connectionFailed(cause?: unknown): InfrastructureAppError {
  return infrastructureError(
    CODES.connectionFailed,
    'The data source could not be reached.',
    cause,
  );
}

export function connectionTimedOut(): InfrastructureAppError {
  return infrastructureError(CODES.connectionTimedOut, 'The data source request timed out.');
}

/** The EXTERNAL system rejected our credentials; unrelated to our own 401. */
export function authenticationFailed(): InfrastructureAppError {
  return infrastructureError(
    CODES.authenticationFailed,
    'The data source rejected the credentials.',
  );
}

export function upstreamError(): InfrastructureAppError {
  return infrastructureError(CODES.upstreamError, 'The data source returned an error.');
}

export function responseTooLarge(): InfrastructureAppError {
  return infrastructureError(CODES.responseTooLarge, 'The data source response is too large.');
}

export function responseUnreadable(cause?: unknown): InfrastructureAppError {
  return infrastructureError(
    CODES.responseUnreadable,
    'The data source response could not be read.',
    cause,
  );
}

export function responseNotJson(cause?: unknown): InfrastructureAppError {
  return infrastructureError(CODES.responseNotJson, 'The data source did not return JSON.', cause);
}

export function noSampleRecords(): InfrastructureAppError {
  return infrastructureError(CODES.noSampleRecords, 'The data source returned no sample records.');
}

export function credentialsMissing(): ValidationAppError {
  return validationError(
    CODES.credentialsMissing,
    'The credentials for this data source are not configured on the server.',
    { [fieldPath('config', 'authMode')]: [FIELD_CODES.credentialsMissing] },
  );
}

/** A kind without a connector (for example MOCK) cannot be tested or fetched. */
export function connectorUnavailable(): ValidationAppError {
  return validationError(
    CODES.connectorUnavailable,
    'No connector is available for this data source kind.',
    { kind: [FIELD_CODES.connectorUnavailable] },
  );
}

/** The host resolves to a non-public address (DNS rebinding defence). */
export function addressNotAllowed(): ValidationAppError {
  return validationError(CODES.addressNotAllowed, 'The data source address is not allowed.', {
    [fieldPath('config', 'baseUrl')]: [FIELD_CODES.urlAddressNotAllowed],
  });
}
