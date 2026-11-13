import { z } from 'zod';

import { AUTH_VALIDATION_CODES, ROLES } from '../../application/contracts/auth-constraints';

import { emailSchema } from './auth-fields-schema';

/** The target value of platform administration in the cross-website invitation. */
export const PLATFORM_TARGET = '__platform__';

/**
 * The invitation form. `tenantId` is the website (or `PLATFORM_TARGET`); inside one website it is
 * that website. The action validates the whole invitation again; this only guides the person.
 */
export const inviteFormSchema = z.object({
  email: emailSchema,
  role: z.enum(ROLES, { message: AUTH_VALIDATION_CODES.roleInvalid }),
  tenantId: z.string().min(1, { message: AUTH_VALIDATION_CODES.tenantInvalid }),
});

export type InviteValues = z.infer<typeof inviteFormSchema>;

/** The invitation's steps: who, what access, then a last look before it is sent. */
export const INVITE_STEPS = ['person', 'access', 'review'] as const;

export type InviteStep = (typeof INVITE_STEPS)[number];

/** The fields each step owns: validated before moving on, and where an error sends the person. */
export const INVITE_STEP_FIELDS: Readonly<Record<InviteStep, ReadonlyArray<keyof InviteValues>>> = {
  person: ['email'],
  access: ['tenantId', 'role'],
  review: [],
};

export const INVITE_STEP_LABELS = {
  person: 'users.invite.steps.person',
  access: 'users.invite.steps.access',
  review: 'users.invite.steps.review',
} as const satisfies Record<InviteStep, string>;

/**
 * The invite page's address: the step on screen and the role the form starts with (for a link
 * that sends people there to add somebody, an employee from the booking team). Untrusted, so
 * anything unknown falls back.
 */
export const invitePageParamsSchema = z.object({
  step: z.enum(INVITE_STEPS).catch('person'),
  role: z.enum(ROLES).optional().catch(undefined),
});
