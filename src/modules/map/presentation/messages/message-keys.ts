import type { MessageCatalog } from '@i18n';

import { fieldPath } from '@lib/errors';
import type { NestedKeyOf } from '@lib/errors';

import {
  MAP_VALIDATION_CODES as CODES,
  MAP_ERROR_CODES as ERRORS,
} from '../../application/contracts/map-constraints';

import type { MapValidationCode, MapErrorCode } from '../../application/contracts/map-constraints';

type ValidKeys = NestedKeyOf<MessageCatalog['map']>;
type MapCode = MapValidationCode | MapErrorCode;

/**
 * Codes -> translation keys, relative to the `map` namespace. A new code
 * fails to compile until it has a message.
 */
export const MESSAGE_KEY_BY_CODE = {
  [ERRORS.invalidInput]: fieldPath('management', 'invalid'),
  [ERRORS.notFound]: fieldPath('states', 'unavailable'),
  [ERRORS.versionConflict]: fieldPath('management', 'conflict'),
  [ERRORS.limitReached]: fieldPath('management', 'limitReached'),
  [ERRORS.sourceFailed]: fieldPath('management', 'failed'),
  [ERRORS.persistenceFailed]: fieldPath('management', 'failed'),
  [ERRORS.rateLimited]: fieldPath('management', 'rateLimited'),
  [ERRORS.limiterFailed]: fieldPath('management', 'failed'),
  [CODES.geometryMissing]: fieldPath('issues', 'geometryMissing'),
  [CODES.geometryUnsupported]: fieldPath('issues', 'geometryUnsupported'),
  [CODES.geometryInvalid]: fieldPath('issues', 'geometryInvalid'),
  [CODES.coordinatesOutOfRange]: fieldPath('issues', 'coordinatesOutOfRange'),
  [CODES.geometryTooLarge]: fieldPath('issues', 'geometryTooLarge'),
  [CODES.duplicateId]: fieldPath('issues', 'duplicateId'),
  [CODES.recordInvalid]: fieldPath('issues', 'recordInvalid'),
} as const satisfies Record<MapCode, ValidKeys>;

export const GENERIC_ERROR_MESSAGE_KEY = fieldPath('issues', 'generic');

export type MessageKey = (typeof MESSAGE_KEY_BY_CODE)[MapCode] | typeof GENERIC_ERROR_MESSAGE_KEY;

function isKnownCode(code: string): code is MapCode {
  return Object.hasOwn(MESSAGE_KEY_BY_CODE, code);
}

/** The shared access check's refusal, which every map operation can meet. */
const PERMISSION_DENIED = 'auth.permission_denied';
const FORBIDDEN_MESSAGE_KEY = fieldPath('management', 'forbidden');

/**
 * Codes from elsewhere fall back to the generic key, or to the caller's own (a failed save is not
 * a feature issue).
 */
export function messageKeyForCode<Fallback extends ValidKeys = typeof GENERIC_ERROR_MESSAGE_KEY>(
  code: string,
  fallback?: Fallback,
): MessageKey | typeof FORBIDDEN_MESSAGE_KEY | Fallback {
  if (isKnownCode(code)) {
    return MESSAGE_KEY_BY_CODE[code];
  }
  if (code === PERMISSION_DENIED) {
    return FORBIDDEN_MESSAGE_KEY;
  }
  return fallback ?? GENERIC_ERROR_MESSAGE_KEY;
}
