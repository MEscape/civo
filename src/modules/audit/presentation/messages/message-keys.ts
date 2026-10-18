import type { MessageCatalog } from '@i18n';

import { fieldPath } from '@lib/errors';
import type { NestedKeyOf } from '@lib/errors';

import {
  AUDIT_ERROR_CODES as ERRORS,
  AUDIT_VALIDATION_CODES as VALIDATION,
} from '../../application/contracts/audit-constraints';

import type { AuditCode } from '../../application/contracts/audit-constraints';

/** Every key of this module's catalog, for tables of message keys. */
export type ValidKeys = NestedKeyOf<MessageCatalog['audit']>;

/** Codes -> translation keys. `satisfies` makes a new code fail to compile until it has a message. */
export const MESSAGE_KEY_BY_CODE = {
  [ERRORS.validationFailed]: fieldPath('errors', 'validation'),
  [ERRORS.persistenceFailed]: fieldPath('errors', 'infrastructure'),
  [VALIDATION.idInvalid]: fieldPath('validation', 'idInvalid'),
} as const satisfies Record<AuditCode, ValidKeys>;

export const GENERIC_ERROR_MESSAGE_KEY = fieldPath('errors', 'unexpected');

export type MessageKey = (typeof MESSAGE_KEY_BY_CODE)[AuditCode] | typeof GENERIC_ERROR_MESSAGE_KEY;

function isAuditCode(code: string): code is AuditCode {
  return Object.hasOwn(MESSAGE_KEY_BY_CODE, code);
}

/** Codes from other modules are unknown here and get the generic message. */
export function messageKeyForCode(code: string): MessageKey {
  return isAuditCode(code) ? MESSAGE_KEY_BY_CODE[code] : GENERIC_ERROR_MESSAGE_KEY;
}
