import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { MS_PER_DAY } from '@lib/utils';

import { AUTH_VALIDATION_CODES, createAuthErrorBag } from '../errors/auth-errors';

import { CREDENTIAL_LIMITS, checkEmail, normalizeEmail } from './credentials';
import { toActorId } from './ids';
import { PLATFORM_ADMIN_ROLE, isRole } from './role';
import { PLATFORM_TENANT_ID, parseTenantHint } from './tenant';

import type { ActorId, InvitationId, TenantId } from './ids';
import type { PlatformRole, TenantRole } from './role';

const INVITATION_LIFETIME_DAYS = 7;

/** Existing deployment bootstrap identity; it grants nothing unless configuration still names the recipient. */
export const BOOTSTRAP_INVITER_ID = toActorId('system');

/** How long an emailed invitation link works: long enough for a busy week, short enough to expire unused. */
export const INVITATION_LIFETIME_MS = INVITATION_LIFETIME_DAYS * MS_PER_DAY;

/**
 * What an invitation offers: a role in a tenant, or (only in the platform
 * scope) the platform administrator role. A request never names the role of
 * a platform offer: `createInvitationOffer` knows tenant roles alone and
 * `createPlatformInvitationOffer` fixes the platform one.
 */
export type InvitationRole = TenantRole | PlatformRole;

/** A pending or used offer to join a tenant with one role. The token is never stored, only its hash. */
export interface Invitation {
  readonly id: InvitationId;
  readonly tenantId: TenantId;
  readonly email: string;
  readonly role: InvitationRole;
  readonly invitedBy: ActorId;
  readonly expiresAt: Date;
  readonly acceptedAt: Date | null;
  readonly createdAt: Date;
}

export interface InvitationInput {
  readonly email: string;
  readonly role: string;
}

export interface InvitationOffer {
  readonly email: string;
  readonly role: TenantRole;
}

export interface PlatformInvitationOffer {
  readonly email: string;
  readonly role: PlatformRole;
}

/** The only way a tenant offer enters the system: a normalised address and a role this code knows. */
export function createInvitationOffer(
  input: InvitationInput,
): AppResult<InvitationOffer, ValidationAppError> {
  const bag = createAuthErrorBag();
  const email = normalizeEmail(input.email);
  checkEmail(email, bag);
  if (!isRole(input.role)) {
    bag.add('role', AUTH_VALIDATION_CODES.roleInvalid);
  }
  if (bag.hasErrors || !isRole(input.role)) {
    return err(bag.toError());
  }
  return ok({ email, role: input.role });
}

/** The platform's own offer: a normalised address and the one role the platform scope hands out. */
export function createPlatformInvitationOffer(
  rawEmail: string,
): AppResult<PlatformInvitationOffer, ValidationAppError> {
  const bag = createAuthErrorBag();
  const email = normalizeEmail(rawEmail);
  checkEmail(email, bag);
  return bag.hasErrors ? err(bag.toError()) : ok({ email, role: PLATFORM_ADMIN_ROLE });
}

/** A token is opaque and case-sensitive: reject malformed values, never trim or truncate them. */
export function isInvitationToken(token: string): boolean {
  return (
    token.length > 0 && token.length <= CREDENTIAL_LIMITS.tokenMax && /^[A-Za-z0-9_-]+$/.test(token)
  );
}

/** True while the invitation can still be accepted: valid scope, not used, not expired. */
export function isInvitationOpen(invitation: Invitation, now: Date): boolean {
  return (
    invitation.acceptedAt === null &&
    invitation.expiresAt.getTime() > now.getTime() &&
    (invitation.role === PLATFORM_ADMIN_ROLE
      ? invitation.tenantId === PLATFORM_TENANT_ID
      : isRole(invitation.role) && parseTenantHint(invitation.tenantId) !== null)
  );
}
