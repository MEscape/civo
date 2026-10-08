import { createIdParser } from '@lib/result';
import type { Brand } from '@lib/utils';

import { DATA_SOURCE_VALIDATION_CODES, fieldValidationFailed } from '../errors/data-source-errors';

/** Opaque identity of a data source. */
export type DataSourceId = Brand<string, 'DataSourceId'>;

/** Opaque identity of a dataset. */
export type DatasetId = Brand<string, 'DatasetId'>;

/** The data-sources module's own brand for a website's identity. */
export type WebsiteId = Brand<string, 'WebsiteId'>;

/** One bound for every identity in this module. */
export const DATA_SOURCE_ID_MAX_LENGTH = 128;

/**
 * Brands an id read from storage. Only infrastructure adapters call this;
 * request values go through the `parse…Id` functions.
 */
export function toDataSourceId(raw: string): DataSourceId {
  return raw as DataSourceId; // Brand constructor: the cast is only permitted here.
}

/** Brands an id read from storage. Only infrastructure adapters call this. */
export function toDatasetId(raw: string): DatasetId {
  return raw as DatasetId; // Brand constructor: the cast is only permitted here.
}

/** Brands a website id read from storage or from another module's adapter. */
export function toWebsiteId(raw: string): WebsiteId {
  return raw as WebsiteId; // Brand constructor: the cast is only permitted here.
}

function hasValidShape(raw: string): boolean {
  return raw.length > 0 && raw.length <= DATA_SOURCE_ID_MAX_LENGTH;
}

const ID_INVALID = DATA_SOURCE_VALIDATION_CODES.idInvalid;

/** Brands a data source id that arrived from a request, after checking its shape. */
export const parseDataSourceId = createIdParser({
  isValid: hasValidShape,
  brand: toDataSourceId,
  mapError: () => fieldValidationFailed('id', ID_INVALID),
});

/** Brands a dataset id that arrived from a request, after checking its shape. */
export const parseDatasetId = createIdParser({
  isValid: hasValidShape,
  brand: toDatasetId,
  mapError: () => fieldValidationFailed('id', ID_INVALID),
});

/** Brands a website id that arrived from a request, after checking its shape. */
export const parseWebsiteId = createIdParser({
  isValid: hasValidShape,
  brand: toWebsiteId,
  mapError: () => fieldValidationFailed('websiteId', ID_INVALID),
});
