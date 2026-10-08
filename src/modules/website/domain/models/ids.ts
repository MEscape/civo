import { createIdParser } from '@lib/result';
import type { Brand } from '@lib/utils';

import { WEBSITE_VALIDATION_CODES, fieldValidationFailed } from '../errors/website-errors';

/** Opaque identity of a website. */
export type WebsiteId = Brand<string, 'WebsiteId'>;

export const WEBSITE_ID_MAX_LENGTH = 128;

/**
 * Brands an id read from storage. Only infrastructure adapters call this;
 * request values go through `parseWebsiteId`.
 */
export function toWebsiteId(raw: string): WebsiteId {
  return raw as WebsiteId; // Brand constructor: the cast is only permitted here.
}

/** Brands an id that arrived from a request, after checking its shape. */
export const parseWebsiteId = createIdParser({
  isValid: (raw: string) => raw.length > 0 && raw.length <= WEBSITE_ID_MAX_LENGTH,
  brand: toWebsiteId,
  mapError: () => fieldValidationFailed('id', WEBSITE_VALIDATION_CODES.idInvalid),
});
