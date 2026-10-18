import type { InfrastructureAppError } from '@lib/errors';
import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { isInvitationOpen } from '../../domain/models/invitation';

import type { PreviewInvitationDependencies } from '../auth-dependencies';
import type { InvitationPreviewView } from '../contracts/user-views';

/**
 * What an emailed invitation offers, for the page that opens it: who it is
 * for, in which role, and until when, so a person sees what they are joining
 * before choosing a password. `null` for a link that is unknown, used or
 * expired, which all look alike (as when accepting). Only what the invited
 * person already has, from the very email the link came in, leaves.
 *
 * @authorization public The single-use token in the emailed link is the credential; it is 256 random bits, so there is nothing to guess.
 */
export class PreviewInvitation {
  constructor(private readonly deps: PreviewInvitationDependencies) {}

  execute(token: string): AppResultAsync<InvitationPreviewView | null, InfrastructureAppError> {
    const { invitations, tokens, clock } = this.deps;

    return invitations.findByTokenHash(tokens.hash(token)).andThen((found) =>
      okAsync(
        found !== null && isInvitationOpen(found, clock.now())
          ? {
              email: found.email,
              role: found.role,
              tenantId: found.tenantId,
              expiresAt: found.expiresAt,
            }
          : null,
      ),
    );
  }
}
