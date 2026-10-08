import { createIdParser } from '@lib/result';
import type { Brand } from '@lib/utils';

import {
  COMPONENT_PLATFORM_VALIDATION_CODES as CODES,
  fieldValidationFailed,
} from '../errors/component-platform-errors';

/**
 * The website a page is rendered for.
 *
 * Branded here: this module never imports another module's id type.
 */
export type WebsiteId = Brand<string, 'WebsiteId'>;

/**
 * The dataset a component is bound to.
 *
 * Branded here for the same reason.
 */
export type DatasetId = Brand<string, 'DatasetId'>;

/**
 * One bound for every identity this module accepts.
 */
export const ID_MAX_LENGTH = 128;

/**
 * Entity ids are opaque strings. Their domain-specific meaning is handled
 * elsewhere; this module only guarantees that the value is non-empty and
 * within the maximum supported length.
 */
export function isValidEntityId(raw: string): boolean {
  return raw.length > 0 && raw.length <= ID_MAX_LENGTH;
}

/*
 * Brand constructors: the casts are only permitted here.
 * Infrastructure calls `to…` for ids read from storage; request values go
 * through `parse…`.
 */
export function toWebsiteId(raw: string): WebsiteId {
  return raw as WebsiteId;
}

export function toDatasetId(raw: string): DatasetId {
  return raw as DatasetId;
}

/**
 * Parses and brands a website id that arrived from an external/request
 * boundary.
 */
export const parseWebsiteId = createIdParser({
  isValid: isValidEntityId,
  brand: toWebsiteId,
  mapError: () => fieldValidationFailed('websiteId', CODES.idInvalid),
});

/**
 * Parses and brands a dataset id that arrived from an external/request
 * boundary.
 */
export const parseDatasetId = createIdParser({
  isValid: isValidEntityId,
  brand: toDatasetId,
  mapError: () => fieldValidationFailed('datasetId', CODES.idInvalid),
});
