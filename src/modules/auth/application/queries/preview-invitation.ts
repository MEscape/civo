import type { InfrastructureAppError } from '@lib/errors';
import { okAsync, ResultAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { isInvitationOpen, isInvitationToken } from '../../domain/models/invitation';
import { PLATFORM_ADMIN_ROLE } from '../../domain/models/role';
import { findAccount } from '../services/find-account';
import { findSignedInActor } from '../services/find-signed-in-actor';

import type { PreviewInvitationDependencies } from '../auth-dependencies';
import type { InvitationPreviewView } from '../contracts/user-views';

/**
 * What an emailed invitation offers, for the page that opens it: who it is
 * for, in which role, and until when, so a person sees what they are joining
 * before choosing a password. `null` for a link that is unknown, used or
 * expired, which all look alike (as when accepting). Only what the invited
 * person already has, from the very email the link came in, leaves.
 * The website lookup follows token validation and selects only its public
 * name. A deleted website invalidates the invitation; a store failure stays
 * an infrastructure error rather than becoming a nameless invitation.
 *
 * @authorization public The single-use token in the emailed link is the credential; it is 256 random bits, so there is nothing to guess.
 * @rate-limit none Runs when a person opens the emailed link; a guess cannot succeed, and the account is only created by `AcceptInvitation`, which is limited.
 */
export class PreviewInvitation {
  constructor(private readonly deps: PreviewInvitationDependencies) {}

  execute(token: string): AppResultAsync<InvitationPreviewView | null, InfrastructureAppError> {
    const { invitations, tokens, clock, tenants, directory, currentActor } = this.deps;
    if (!isInvitationToken(token)) {
      return okAsync(null);
    }
    return invitations
      .findByTokenHash(tokens.hash(token))
      .andThen((found): AppResultAsync<InvitationPreviewView | null, InfrastructureAppError> => {
        if (found === null || !isInvitationOpen(found, clock.now())) {
          return okAsync(null);
        }
        const isPlatformInvitation = found.role === PLATFORM_ADMIN_ROLE;
        const websiteName = isPlatformInvitation ? okAsync(null) : tenants.findName(found.tenantId);
        return ResultAsync.combine([
          websiteName,
          directory.findByEmail(found.email),
          findAccount(directory, found.invitedBy),
          findSignedInActor(currentActor),
        ] as const).map(([organisation, account, inviter, actor]) =>
          organisation === null && !isPlatformInvitation
            ? null
            : {
                email: found.email,
                role: found.role,
                organisation,
                expiresAt: found.expiresAt,
                requiresExistingAccount: account !== null,
                canAcceptExistingAccount:
                  account !== null && account.emailVerified && actor?.id === account.id,
                invitedBy: inviter?.name ?? null,
              },
        );
      });
  }
}
