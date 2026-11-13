import type { InfrastructureAppError } from '@lib/errors';
import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { normalizeEmail } from '../../domain/models/credentials';
import { BOOTSTRAP_INVITER_ID } from '../../domain/models/invitation';
import { PLATFORM_ADMIN_ROLE, permissionsForRole } from '../../domain/models/role';

import { findAccount } from './find-account';
import { isConfiguredPlatformAdmin } from './is-platform-administrator';

import type { Invitation } from '../../domain/models/invitation';
import type { AcceptInvitationDependencies } from '../auth-dependencies';

export interface InvitationAuthority {
  readonly isAllowed: boolean;
  /** The inviter's authority comes from verified deployment configuration, not from a stored membership. */
  readonly bootstrapAuthority: boolean;
}

const BOOTSTRAP: InvitationAuthority = { isAllowed: true, bootstrapAuthority: true };
const GRANTED: InvitationAuthority = { isAllowed: true, bootstrapAuthority: false };
const DENIED: InvitationAuthority = { isAllowed: false, bootstrapAuthority: false };

/** Bootstrap authority comes only from current verified deployment configuration. */
function hasBootstrapAuthority(
  deps: AcceptInvitationDependencies,
  invitation: Invitation,
): AppResultAsync<boolean, InfrastructureAppError> {
  if (invitation.invitedBy === BOOTSTRAP_INVITER_ID) {
    return okAsync(
      invitation.role === PLATFORM_ADMIN_ROLE &&
        deps.bootstrapAdminEmails.has(normalizeEmail(invitation.email)),
    );
  }
  return findAccount(deps.directory, invitation.invitedBy).map(
    (inviter) => inviter !== null && isConfiguredPlatformAdmin(deps.bootstrapAdminEmails, inviter),
  );
}

/** Only platform authority can offer the platform role; a website offer needs a manager of that website. */
function inviterManagesWebsite(
  deps: AcceptInvitationDependencies,
  invitation: Invitation,
): AppResultAsync<boolean, InfrastructureAppError> {
  if (invitation.role === PLATFORM_ADMIN_ROLE) {
    return okAsync(false);
  }
  return deps.members
    .findRoles(invitation.invitedBy, invitation.tenantId)
    .map((roles) => roles.some((role) => permissionsForRole(role).includes('user.manage')));
}

/** Authority held through a stored membership: a platform administrator, or a manager of the offer's website. */
function hasStoredAuthority(
  deps: AcceptInvitationDependencies,
  invitation: Invitation,
): AppResultAsync<boolean, InfrastructureAppError> {
  return deps.members
    .isPlatformAdmin(invitation.invitedBy)
    .andThen((isPlatform) =>
      isPlatform ? okAsync(true) : inviterManagesWebsite(deps, invitation),
    );
}

/** Recheck before account setup as well as inside the grant transaction; revoked offers cannot create accounts. */
export function resolveInvitationAuthority(
  deps: AcceptInvitationDependencies,
  invitation: Invitation,
): AppResultAsync<InvitationAuthority, InfrastructureAppError> {
  return hasBootstrapAuthority(deps, invitation).andThen(
    (isBootstrap): AppResultAsync<InvitationAuthority, InfrastructureAppError> =>
      isBootstrap
        ? okAsync(BOOTSTRAP)
        : hasStoredAuthority(deps, invitation).map((isAllowed) => (isAllowed ? GRANTED : DENIED)),
  );
}
