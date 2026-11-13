import type { ConflictAppError, InfrastructureAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { invitationPending } from '../../domain/errors/auth-errors';
import { INVITATION_LIFETIME_MS } from '../../domain/models/invitation';

import type { Invitation } from '../../domain/models/invitation';
import type { AuthMailer, MailLocale } from '../../domain/ports/auth-mailer.port';
import type { NewInvitation } from '../../domain/ports/invitation.repository';
import type { BootstrapDependencies } from '../auth-dependencies';

type IssuanceDependencies = Pick<
  BootstrapDependencies,
  'invitations' | 'tokens' | 'mailer' | 'audit' | 'clock'
>;
type InvitationMail = Parameters<AuthMailer['sendInvitation']>[0];
type InvitationRequest = Omit<NewInvitation, 'expiresAt' | 'tokenHash'> & {
  readonly locale: MailLocale;
  readonly inviterName?: string | null;
  readonly websiteName?: string | null;
};

/**
 * A link nobody received must not stay claimable. The mail failure stays the answer; a failed
 * cleanup is already logged once by the repository's persistence boundary (observability.md).
 */
function deliverOrRevoke(
  deps: IssuanceDependencies,
  invitation: Invitation,
  mail: InvitationMail,
): AppResultAsync<void, InfrastructureAppError> {
  return deps.mailer.sendInvitation(mail).orElse((error) =>
    deps.invitations
      .revoke(invitation.id, invitation.tenantId)
      .orElse(() => okAsync(false))
      .andThen(() => errAsync(error)),
  );
}

/** Both operator bootstrap and user administration issue and deliver the same single-use lifecycle. */
export function issueInvitation(
  deps: IssuanceDependencies,
  { locale, inviterName, websiteName, ...offer }: InvitationRequest,
): AppResultAsync<void, InfrastructureAppError | ConflictAppError> {
  const { invitations, tokens, audit, clock } = deps;
  const issued = tokens.issue();
  const now = clock.now();

  return invitations
    .createPending(
      {
        ...offer,
        expiresAt: new Date(now.getTime() + INVITATION_LIFETIME_MS),
        tokenHash: issued.hash,
      },
      now,
    )
    .andThen((invitation) =>
      invitation === null ? errAsync(invitationPending()) : okAsync(invitation),
    )
    .andThen((invitation) =>
      deliverOrRevoke(deps, invitation, {
        to: offer.email,
        token: issued.token,
        locale,
        inviterName: inviterName ?? null,
        websiteName: websiteName ?? null,
      }).map(() => {
        audit.record({
          type: 'invitation.created',
          actorId: offer.invitedBy,
          tenantId: offer.tenantId,
          invitationId: invitation.id,
          role: offer.role,
        });
      }),
    );
}
