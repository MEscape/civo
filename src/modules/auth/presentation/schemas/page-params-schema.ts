import { z } from 'zod';

import { RETURN_PATH_MAX_LENGTH } from '../navigation/return-path';

import { tokenSchema } from './auth-fields-schema';

/**
 * Search parameters are untrusted and may be repeated (`?a=1&a=2` arrives
 * as an array), so each page parses them instead of casting (validation.md).
 */
const returnToSchema = z.object({
  returnTo: z.string().max(RETURN_PATH_MAX_LENGTH).optional().catch(undefined),
});

const resetTokenSchema = z.object({
  token: tokenSchema.optional().catch(undefined),
});

const verificationSchema = z.object({
  error: z.string().optional().catch(undefined),
});

export function parseSignInPageParams(raw: unknown): {
  readonly returnTo: string | undefined;
} {
  return { returnTo: returnToSchema.parse(raw).returnTo };
}

export function parseResetPasswordPageParams(raw: unknown): {
  readonly token: string | undefined;
} {
  return { token: resetTokenSchema.parse(raw).token };
}

/** `hasFailed` is true when Better Auth redirected back with an `error` parameter. */
export function parseEmailVerifiedPageParams(raw: unknown): {
  readonly hasFailed: boolean;
} {
  return { hasFailed: verificationSchema.parse(raw).error !== undefined };
}
