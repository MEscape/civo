import { createIdParser } from '@lib/result';
import type { Brand } from '@lib/utils';

import { mapInvalidInput } from '../errors/map-errors';

export type MapId = Brand<string, 'MapId'>;
export type WebsiteId = Brand<string, 'WebsiteId'>;
export type DatasetId = Brand<string, 'DatasetId'>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Website and dataset identities are opaque strings owned by their respective modules. */
export const EXTERNAL_MAP_ID_MAX_LENGTH = 128;
const isExternalId = (value: string) =>
  value.length > 0 && value.length <= EXTERNAL_MAP_ID_MAX_LENGTH;

export const toMapId = (value: string): MapId => value as MapId;
export const toWebsiteId = (value: string): WebsiteId => value as WebsiteId;
export const toDatasetId = (value: string): DatasetId => value as DatasetId;
export const parseMapId = createIdParser({
  isValid: (value) => UUID_PATTERN.test(value),
  brand: toMapId,
  mapError: () => mapInvalidInput(),
});
/** @keep Every branded id has a validating parser for request values; dataset ids are branded when read, not yet parsed from a request. */
export const parseDatasetId = createIdParser({
  isValid: isExternalId,
  brand: toDatasetId,
  mapError: () => mapInvalidInput(),
});
export const parseWebsiteId = createIdParser({
  isValid: isExternalId,
  brand: toWebsiteId,
  mapError: () => mapInvalidInput(),
});
