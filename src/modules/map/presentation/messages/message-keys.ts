import type { MessageCatalog } from '@i18n';

import { fieldPath } from '@lib/errors/validation';
import type { NestedKeyOf } from '@lib/errors/validation';

import { MAP_VALIDATION_CODES as CODES } from '../../application/contracts/map-constraints';

import type { MapValidationCode } from '../../application/contracts/map-constraints';

type ValidKeys = NestedKeyOf<MessageCatalog['map']>;

/**
 * Codes -> translation keys, relative to the `map` namespace. A new code
 * fails to compile until it has a message.
 */
export const MESSAGE_KEY_BY_CODE = {
  [CODES.geometryMissing]: fieldPath('issues', 'geometryMissing'),
  [CODES.geometryUnsupported]: fieldPath('issues', 'geometryUnsupported'),
  [CODES.geometryInvalid]: fieldPath('issues', 'geometryInvalid'),
  [CODES.coordinatesOutOfRange]: fieldPath('issues', 'coordinatesOutOfRange'),
  [CODES.geometryTooLarge]: fieldPath('issues', 'geometryTooLarge'),
  [CODES.duplicateId]: fieldPath('issues', 'duplicateId'),
} as const satisfies Record<MapValidationCode, ValidKeys>;

export const GENERIC_ERROR_MESSAGE_KEY = fieldPath('issues', 'generic');

export type MessageKey =
  (typeof MESSAGE_KEY_BY_CODE)[MapValidationCode] | typeof GENERIC_ERROR_MESSAGE_KEY;

function isKnownCode(code: string): code is MapValidationCode {
  return Object.hasOwn(MESSAGE_KEY_BY_CODE, code);
}

/** Codes from elsewhere fall back to the generic key. */
export function messageKeyForCode(code: string): MessageKey {
  return isKnownCode(code) ? MESSAGE_KEY_BY_CODE[code] : GENERIC_ERROR_MESSAGE_KEY;
}
