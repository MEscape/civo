import type { FieldErrorBag, ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import { AUTH_VALIDATION_CODES, createAuthErrorBag } from '../errors/auth-errors';

import { CREDENTIAL_LIMITS, EMAIL_PATTERN, normalizeEmail } from './credentials';
import { isRole } from './role';

import type { ActorId, InvitationId, TenantId } from './ids';
import type { Role } from './role';

const MS_PER_DAY = 86_400_000;
const INVITATION_LIFETIME_DAYS = 7;

/** How long an emailed invitation link works: long enough for a busy week, short enough to expire unused. */
export const INVITATION_LIFETIME_MS = INVITATION_LIFETIME_DAYS * MS_PER_DAY;

/** A pending or used offer to join a tenant with one role. The token is never stored, only its hash. */
export interface Invitation {
  readonly id: InvitationId;
  readonly tenantId: TenantId;
  readonly email: string;
  readonly role: Role;
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
  readonly role: Role;
}

function checkOffer(email: string, role: string, bag: FieldErrorBag): void {
  if (email.length === 0) {
    bag.add('email', AUTH_VALIDATION_CODES.emailRequired);
  } else if (email.length > CREDENTIAL_LIMITS.emailMax) {
    bag.add('email', AUTH_VALIDATION_CODES.emailTooLong);
  } else if (!EMAIL_PATTERN.test(email)) {
    bag.add('email', AUTH_VALIDATION_CODES.emailInvalid);
  }
  if (!isRole(role)) {
    bag.add('role', AUTH_VALIDATION_CODES.roleInvalid);
  }
}

/** The only way an offer enters the system: a normalised address and a role this code knows. */
export function createInvitationOffer(
  input: InvitationInput,
): AppResult<InvitationOffer, ValidationAppError> {
  const bag = createAuthErrorBag();
  const email = normalizeEmail(input.email);
  checkOffer(email, input.role, bag);
  if (bag.hasErrors || !isRole(input.role)) {
    return err(bag.toError());
  }
  return ok({ email, role: input.role });
}

/** True while the invitation can still be accepted: not used, not expired. */
export function isInvitationOpen(invitation: Invitation, now: Date): boolean {
  return invitation.acceptedAt === null && invitation.expiresAt.getTime() > now.getTime();
}
