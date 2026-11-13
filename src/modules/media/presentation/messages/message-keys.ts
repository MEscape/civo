import type { MessageCatalog } from '@i18n';

import { fieldPath } from '@lib/errors';
import type { NestedKeyOf } from '@lib/errors';
import type { SerializedActionError } from '@lib/result';

import {
  MEDIA_ERROR_CODES as ERRORS,
  MEDIA_LIMITS,
  MEDIA_VALIDATION_CODES as VALIDATION,
} from '../../application/contracts/media-constraints';

import type { MediaCode } from '../../application/contracts/media-constraints';

type ValidKeys = NestedKeyOf<MessageCatalog['media']>;

/**
 * Codes -> translation keys, relative to the `media` namespace. `satisfies Record<MediaCode, ...>`
 * makes a new code fail to compile until it has a message.
 */
export const MESSAGE_KEY_BY_CODE = {
  [ERRORS.notFound]: fieldPath('errors', 'notFound'),
  [ERRORS.validationFailed]: fieldPath('errors', 'validation'),
  [ERRORS.persistenceFailed]: fieldPath('errors', 'infrastructure'),
  [ERRORS.storageDisabled]: fieldPath('errors', 'storageDisabled'),
  [ERRORS.storageFailed]: fieldPath('errors', 'storageFailed'),
  [ERRORS.tooManyPending]: fieldPath('errors', 'tooManyPending'),
  [ERRORS.uploadMissing]: fieldPath('errors', 'uploadMissing'),
  [ERRORS.uploadRejected]: fieldPath('errors', 'uploadRejected'),
  [ERRORS.inUse]: fieldPath('errors', 'inUse'),
  [ERRORS.notPrivate]: fieldPath('errors', 'notPrivate'),
  [ERRORS.notReady]: fieldPath('errors', 'notReady'),
  [ERRORS.rateLimited]: fieldPath('errors', 'rateLimited'),
  [ERRORS.rateLimiterFailed]: fieldPath('errors', 'infrastructure'),
  [VALIDATION.websiteInvalid]: fieldPath('validation', 'websiteInvalid'),
  [VALIDATION.idInvalid]: fieldPath('validation', 'idInvalid'),
  [VALIDATION.fileNameInvalid]: fieldPath('validation', 'fileNameInvalid'),
  [VALIDATION.contentTypeUnsupported]: fieldPath('validation', 'contentTypeUnsupported'),
  [VALIDATION.sizeInvalid]: fieldPath('validation', 'sizeInvalid'),
  [VALIDATION.sizeTooLarge]: fieldPath('validation', 'sizeTooLarge'),
  [VALIDATION.visibilityUnsupported]: fieldPath('validation', 'visibilityUnsupported'),
} as const satisfies Record<MediaCode, ValidKeys>;

export const GENERIC_ERROR_MESSAGE_KEY = fieldPath('errors', 'unexpected');

/** The browser could not send the file to the store (offline, blocked, refused). Known to the client only. */
export const TRANSFER_FAILED_CODE = 'media.client.transfer_failed';
const TRANSFER_FAILED_MESSAGE_KEY = fieldPath('errors', 'transferFailed');

export type MessageKey =
  | (typeof MESSAGE_KEY_BY_CODE)[MediaCode]
  | typeof GENERIC_ERROR_MESSAGE_KEY
  | typeof TRANSFER_FAILED_MESSAGE_KEY;

function isMediaCode(code: string): code is MediaCode {
  return Object.hasOwn(MESSAGE_KEY_BY_CODE, code);
}

/** Codes from other modules (authorization, for instance) are unknown here and get the generic message. */
export function messageKeyForCode(code: string): MessageKey {
  if (code === TRANSFER_FAILED_CODE) {
    return TRANSFER_FAILED_MESSAGE_KEY;
  }
  return isMediaCode(code) ? MESSAGE_KEY_BY_CODE[code] : GENERIC_ERROR_MESSAGE_KEY;
}

/**
 * The message for a failed action that has no form fields to put errors on: the first field
 * error's code if there is one (it is the most specific), else the error's own.
 */
export function messageKeyForError(error: SerializedActionError): MessageKey {
  const [firstCodes] = Object.values(error.fieldErrors ?? {});
  return messageKeyForCode(firstCodes?.[0] ?? error.code);
}

const BYTES_PER_MEGABYTE = 1_048_576;

/** Interpolation values for messages that mention a limit. */
export const MESSAGE_PARAMS = {
  maxMegabytes: MEDIA_LIMITS.maxBytes / BYTES_PER_MEGABYTE,
} as const;
