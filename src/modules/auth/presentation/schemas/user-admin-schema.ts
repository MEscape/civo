import { z } from 'zod';

import {
  AUTH_VALIDATION_CODES as CODES,
  CREDENTIAL_LIMITS,
  ROLES,
} from '../../application/contracts/auth-constraints';

import { emailSchema } from './auth-fields-schema';

const idSchema = z.string().min(1).max(CREDENTIAL_LIMITS.idMax);

const roleSchema = z.enum(ROLES, { message: CODES.roleInvalid });

export const inviteUserSchema = z.object({ email: emailSchema, role: roleSchema });

export const changeUserRolesSchema = z.object({
  userId: idSchema,
  roles: z.array(roleSchema).min(1, { message: CODES.rolesRequired }).max(ROLES.length),
});

export const grantPlatformAdminSchema = z.object({ email: emailSchema });

export const removeUserSchema = z.object({ userId: idSchema });

export const revokeInvitationSchema = z.object({ invitationId: idSchema });

/**
 * The list address parameters. Untrusted and possibly repeated, so every one
 * falls back instead of failing: a hand-edited URL shows the unfiltered list,
 * not an error page.
 */
export const userListParamsSchema = z.object({
  page: z.string().optional().catch(undefined),
  pageSize: z.string().optional().catch(undefined),
  q: z.string().trim().max(CREDENTIAL_LIMITS.searchMax).optional().catch(undefined),
  role: roleSchema.optional().catch(undefined),
  /** The role the invitation form starts with, for a link that sends people there to add somebody (an employee, from the booking team). */
  invite: roleSchema.optional().catch(undefined),
  sort: z.string().optional().catch(undefined),
});
