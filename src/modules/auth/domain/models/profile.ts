import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import { AUTH_VALIDATION_CODES, authValidationFailed } from '../errors/auth-errors';

import { CREDENTIAL_LIMITS } from './credentials';

/** Below the framework's 1 MB action limit, including multipart overhead. */
export const PROFILE_IMAGE_MAX_BYTES = 524_288;
export const PROFILE_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

const PNG_SIGNATURE = '\x89PNG\r\n\x1a\n';
const JPEG_SIGNATURE = '\xff\xd8\xff';
const RIFF_SIGNATURE = 'RIFF';
const WEBP_SIGNATURE = 'WEBP';
const WEBP_SIGNATURE_OFFSET = 8;

export interface ProfileImage {
  readonly bytes: Uint8Array;
  readonly contentType: string;
}

export interface ProfileDraft {
  readonly name: string;
  /** Undefined preserves the photo; null removes it. URLs and user IDs are never accepted. */
  readonly image?: ProfileImage | null;
}

function hasImageSignature({ bytes, contentType }: ProfileImage): boolean {
  const startsWith = (signature: string, offset = 0) =>
    Array.from(signature).every((char, i) => bytes[i + offset] === char.charCodeAt(0));
  if (contentType === 'image/png') {
    return startsWith(PNG_SIGNATURE);
  }
  if (contentType === 'image/jpeg') {
    return startsWith(JPEG_SIGNATURE);
  }
  return (
    contentType === 'image/webp' &&
    startsWith(RIFF_SIGNATURE) &&
    startsWith(WEBP_SIGNATURE, WEBP_SIGNATURE_OFFSET)
  );
}

export function createProfileDraft(
  input: ProfileDraft,
): AppResult<ProfileDraft, ValidationAppError> {
  const name = input.name.trim();
  if (name.length === 0 || name.length > CREDENTIAL_LIMITS.nameMax) {
    return err(
      authValidationFailed({
        name: [
          name.length === 0
            ? AUTH_VALIDATION_CODES.nameRequired
            : AUTH_VALIDATION_CODES.nameTooLong,
        ],
      }),
    );
  }
  if (
    input.image &&
    (input.image.bytes.byteLength > PROFILE_IMAGE_MAX_BYTES || !hasImageSignature(input.image))
  ) {
    return err(authValidationFailed({ image: [AUTH_VALIDATION_CODES.profileImageInvalid] }));
  }
  return ok({ ...input, name });
}
