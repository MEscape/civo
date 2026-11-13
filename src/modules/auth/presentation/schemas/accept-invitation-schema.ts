import { z } from 'zod';

import { AUTH_VALIDATION_CODES as CODES } from '../../application/contracts/auth-constraints';

import { nameSchema, newPasswordSchema, tokenSchema } from './auth-fields-schema';

/** The address is not a field: it belongs to the invitation the token names. */
export const acceptInvitationSchema = z
  .object({
    token: tokenSchema,
    name: nameSchema.optional(),
    password: newPasswordSchema.optional(),
    confirmPassword: z.string().optional(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: CODES.passwordMismatch,
  });

export type AcceptInvitation = z.infer<typeof acceptInvitationSchema>;
