import { z } from 'zod';

import { AUTH_VALIDATION_CODES } from '../../application/contracts/auth-constraints';
import {
  PROFILE_IMAGE_MAX_BYTES,
  PROFILE_IMAGE_TYPES,
} from '../../application/contracts/profile-views';

import { nameSchema } from './auth-fields-schema';

export const profileSchema = z.object({
  name: nameSchema,
  removeImage: z.boolean(),
  image: z
    .file()
    .min(1, AUTH_VALIDATION_CODES.profileImageInvalid)
    .max(PROFILE_IMAGE_MAX_BYTES, AUTH_VALIDATION_CODES.profileImageInvalid)
    .mime([...PROFILE_IMAGE_TYPES], AUTH_VALIDATION_CODES.profileImageInvalid)
    .optional(),
});

export const profileFormDataSchema = z.instanceof(FormData, {
  message: AUTH_VALIDATION_CODES.nameRequired,
});
