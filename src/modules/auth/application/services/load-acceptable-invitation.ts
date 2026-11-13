import type { InfrastructureAppError, UnauthorizedAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { invalidToken } from '../../domain/errors/auth-errors';
import { isInvitationOpen, isInvitationToken } from '../../domain/models/invitation';
import { PLATFORM_ADMIN_ROLE } from '../../domain/models/role';

import { resolveInvitationAuthority } from './invitation-authority';

import type { Invitation } from '../../domain/models/invitation';
import type { AcceptInvitationDependencies } from '../auth-dependencies';

type LookupError = InfrastructureAppError | UnauthorizedAppError;

interface AcceptableInvitation {
  readonly invitation: Invitation;
  readonly bootstrapAuthority: boolean;
}

/** An open offer is usable only while its expiry holds and, for a website offer, the website still exists. */
function requireOpenScope(
  deps: AcceptInvitationDependencies,
  invitation: Invitation,
): AppResultAsync<Invitation, LookupError> {
  if (!isInvitationOpen(invitation, deps.clock.now())) {
    return errAsync(invalidToken());
  }
  if (invitation.role === PLATFORM_ADMIN_ROLE) {
    return okAsync(invitation);
  }
  return deps.tenants
    .exists(invitation.tenantId)
    .andThen((exists) => (exists ? okAsync(invitation) : errAsync(invalidToken())));
}

/**
 * Whether granting this offer rests on deployment configuration rather than a stored membership.
 * A consumed offer grants nothing again, so it needs no inviter authority; any other offer whose
 * inviter no longer has authority answers like an unknown link.
 */
export function loadAcceptableInvitation(
  deps: AcceptInvitationDependencies,
  token: string,
): AppResultAsync<AcceptableInvitation, LookupError> {
  if (!isInvitationToken(token)) {
    return errAsync(invalidToken());
  }
  return deps.invitations.findByTokenHash(deps.tokens.hash(token)).andThen((found) => {
    if (found === null) {
      return errAsync(invalidToken());
    }
    // A consumed offer stays loadable so its account can confirm it again (see `AcceptInvitation.join`).
    if (found.acceptedAt !== null) {
      return okAsync({ invitation: found, bootstrapAuthority: false });
    }
    return requireOpenScope(deps, found)
      .andThen(() => resolveInvitationAuthority(deps, found))
      .andThen((authority): AppResultAsync<AcceptableInvitation, LookupError> =>
        authority.isAllowed
          ? okAsync({ invitation: found, bootstrapAuthority: authority.bootstrapAuthority })
          : errAsync(invalidToken()),
      );
  });
}
