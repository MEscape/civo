import { z } from 'zod';

import { pageParamsSchema } from '@lib/pagination';

import {
  AUTH_VALIDATION_CODES as CODES,
  CREDENTIAL_LIMITS,
  ROLES,
} from '../../application/contracts/auth-constraints';

import { emailSchema } from './auth-fields-schema';

const idSchema = z.string().min(1).max(CREDENTIAL_LIMITS.idMax);

const roleSchema = z.enum(ROLES, { message: CODES.roleInvalid });
const filterRoleSchema = z.union([roleSchema, z.literal('platform_admin')]);
/** The roles the editor saw; an empty list means it saw no access. Required, so no write is a blind overwrite. */
const expectedRolesSchema = z.array(roleSchema).max(ROLES.length);

const tenantIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, { message: CODES.tenantInvalid });

const inviteWebsiteSchema = z.object({
  scope: z.literal('website'),
  email: emailSchema,
  role: roleSchema,
  tenantId: tenantIdSchema.optional(),
});

/** A platform invitation carries no role: the platform scope offers exactly one, chosen by the server. */
const invitePlatformSchema = z.object({
  scope: z.literal('platform'),
  email: emailSchema,
});

/** Who is invited and to what. The scope picks the use case's permission. */
export const inviteUserSchema = z.discriminatedUnion('scope', [
  inviteWebsiteSchema,
  invitePlatformSchema,
]);

/** One website's roles for one person, set by an authorized manager: at least one, or the access is removed instead. */
export const setUserAccessSchema = z.object({
  userId: idSchema,
  tenantId: idSchema,
  roles: z.array(roleSchema).min(1, { message: CODES.rolesRequired }).max(ROLES.length),
  expectedRoles: expectedRolesSchema,
});

export const removeUserAccessSchema = z.object({
  userId: idSchema,
  tenantId: idSchema,
  expectedRoles: expectedRolesSchema,
});

export const platformAdminSchema = z.object({ userId: idSchema });

export const revokeInvitationSchema = z.object({
  invitationId: idSchema,
  tenantId: idSchema.optional(),
});

/**
 * The list address parameters of either scope. Untrusted and possibly repeated,
 * so every one falls back instead of failing: a hand-edited URL shows the
 * unfiltered list, not an error page. `website` narrows the cross-website list
 * and is ignored inside one website.
 */
export const userListParamsSchema = pageParamsSchema.extend({
  invitationsPage: z.string().optional().catch(undefined),
  q: z.string().trim().max(CREDENTIAL_LIMITS.searchMax).optional().catch(undefined),
  role: filterRoleSchema.optional().catch(undefined),
  website: idSchema.optional().catch(undefined),
  /** Set by the invite page after sending, so the list says the invitation went out. */
  invited: z.literal('1').optional().catch(undefined),
  sort: z.string().optional().catch(undefined),
});
