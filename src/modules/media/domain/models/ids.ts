import { createIdParser } from '@lib/result';
import type { Brand } from '@lib/utils';

import { MEDIA_VALIDATION_CODES, fieldValidationFailed } from '../errors/media-errors';

/** Opaque identity of an uploaded file. The database mints it; it is a UUID. */
export type MediaAssetId = Brand<string, 'MediaAssetId'>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Brands an id read from storage. Only infrastructure adapters call this. */
export function toMediaAssetId(raw: string): MediaAssetId {
  return raw as MediaAssetId; // Brand constructor: the cast is only permitted here.
}

/**
 * Brands an id that arrived from a request. The shape is checked strictly: the id becomes part
 * of an object key, so nothing but a UUID may pass.
 */
export const parseMediaAssetId = createIdParser({
  isValid: (raw: string) => UUID.test(raw),
  brand: toMediaAssetId,
  mapError: () => fieldValidationFailed('id', MEDIA_VALIDATION_CODES.idInvalid),
});
