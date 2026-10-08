import type { MessageCatalog } from '@i18n';

import { fieldPath } from '@lib/errors/validation';
import type { NestedKeyOf } from '@lib/errors/validation';

import {
  COMPONENT_PLATFORM_ERROR_CODES as ERRORS,
  COMPONENT_PLATFORM_VALIDATION_CODES as VALIDATION,
} from '../../application/contracts/component-platform-constraints';

import type {
  ComponentPlatformErrorCode,
  ComponentPlatformValidationCode,
} from '../../application/contracts/component-platform-constraints';

type ValidKeys = NestedKeyOf<MessageCatalog['componentPlatform']>;
type ComponentPlatformCode = ComponentPlatformErrorCode | ComponentPlatformValidationCode;

const REQUEST_INVALID = fieldPath('origin', 'requestInvalid');

/**
 * Codes -> translation keys, relative to the `componentPlatform` namespace.
 * `satisfies Record<ComponentPlatformCode, ...>` makes a new code fail to
 * compile until it has a message.
 *
 * The codes that describe why a dataset could not be used end up in the
 * "sample data" badge an editor sees. Validation codes describe a rejected
 * record or id and are never shown field by field, so they share one key.
 */
export const MESSAGE_KEY_BY_CODE = {
  [ERRORS.datasetNotFound]: fieldPath('origin', 'datasetNotFound'),
  [ERRORS.datasetNotMapped]: fieldPath('origin', 'datasetNotMapped'),
  [ERRORS.datasetKindMismatch]: fieldPath('origin', 'datasetKindMismatch'),
  [ERRORS.sourceFailed]: fieldPath('origin', 'sourceFailed'),
  [ERRORS.recordInvalid]: REQUEST_INVALID,
  [ERRORS.componentNotRegistered]: fieldPath('render', 'unknownComponent'),
  [VALIDATION.idInvalid]: REQUEST_INVALID,
  [VALIDATION.required]: REQUEST_INVALID,
  [VALIDATION.tooLong]: REQUEST_INVALID,
  [VALIDATION.tooShort]: REQUEST_INVALID,
  [VALIDATION.tooMany]: REQUEST_INVALID,
  [VALIDATION.typeInvalid]: REQUEST_INVALID,
  [VALIDATION.outOfRange]: REQUEST_INVALID,
  [VALIDATION.formatInvalid]: REQUEST_INVALID,
  [VALIDATION.optionUnknown]: REQUEST_INVALID,
  [VALIDATION.instantInvalid]: REQUEST_INVALID,
  [VALIDATION.urlUnsafe]: REQUEST_INVALID,
} as const satisfies Record<ComponentPlatformCode, ValidKeys>;

export const GENERIC_ERROR_MESSAGE_KEY = fieldPath('origin', 'sourceFailed');

/** Shown when nothing is bound yet: there is no error, so no code. */
export const UNBOUND_MESSAGE_KEY = fieldPath('origin', 'sampleUnbound');

export type MessageKey =
  | (typeof MESSAGE_KEY_BY_CODE)[ComponentPlatformCode]
  | typeof GENERIC_ERROR_MESSAGE_KEY
  | typeof UNBOUND_MESSAGE_KEY;

function isKnownCode(code: string): code is ComponentPlatformCode {
  return Object.hasOwn(MESSAGE_KEY_BY_CODE, code);
}

/** Codes from other modules fall back to the generic key. */
export function messageKeyForCode(code: string): MessageKey {
  return isKnownCode(code) ? MESSAGE_KEY_BY_CODE[code] : GENERIC_ERROR_MESSAGE_KEY;
}

/** Why a sample is shown: no cause means nothing is bound yet. */
export function originMessageKey(cause: string | null): MessageKey {
  return cause === null ? UNBOUND_MESSAGE_KEY : messageKeyForCode(cause);
}
