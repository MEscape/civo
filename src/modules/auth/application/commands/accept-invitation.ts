import type { InfrastructureAppError, UnauthorizedAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { invalidToken, invitationFailed } from '../../domain/errors/auth-errors';
import { createSignUpDraft } from '../../domain/models/credentials';
import { isInvitationOpen } from '../../domain/models/invitation';
import { PLATFORM_ADMIN_ROLE } from '../../domain/models/role';
import { PLATFORM_TENANT_ID } from '../../domain/models/tenant';
import { AUTH_RATE_LIMITS } from '../rate-limits';
import { enforceClientAndAccountLimits } from '../services/enforce-rate-limit';

import type { ActorId } from '../../domain/models/ids';
import type { Invitation } from '../../domain/models/invitation';
import type { AuthenticatorError } from '../../domain/ports/authenticator.port';
import type {
  AcceptInvitationDependencies,
  AuthenticationDependencies,
} from '../auth-dependencies';
import type { RateLimitError } from '../services/enforce-rate-limit';

export type AcceptInvitationError =
  | AuthenticatorError
  | RateLimitError
  | InfrastructureAppError
  | UnauthorizedAppError
  | ValidationAppError;

export interface AcceptInvitationInput {
  readonly token: string;
  readonly name: string;
  readonly password: string;
}

/**
 * Turns an emailed invitation into an account with the invited role. The
 * address is the invitation's, never the request's. The invitation is
 * claimed first, so two requests with the same link cannot both create an
 * account, and given back if the account cannot be set up. A link that is
 * unknown, used or expired all answer the same way.
 *
 * @authorization public The single-use token in the emailed link is the credential; the rate limiter gates it.
 */
export class AcceptInvitation {
  constructor(private readonly deps: AcceptInvitationDependencies) {}

  execute(input: AcceptInvitationInput): AppResultAsync<undefined, AcceptInvitationError> {
    const { invitations, tokens, clock } = this.deps;

    return invitations
      .findByTokenHash(tokens.hash(input.token))
      .andThen((found): AppResultAsync<Invitation, AcceptInvitationError> => {
        return found !== null && isInvitationOpen(found, clock.now())
          ? okAsync(found)
          : errAsync(invalidToken());
      })
      .andThen((invitation) =>
        createSignUpDraft({ name: input.name, email: invitation.email, password: input.password })
          .asyncAndThen((draft) =>
            enforceClientAndAccountLimits(
              this.deps,
              { client: AUTH_RATE_LIMITS.signUpClient, account: AUTH_RATE_LIMITS.signUp },
              invitation.email,
            ).map(() => draft),
          )
          .andThen((draft) => this.join(invitation, draft)),
      );
  }

  /**
   * What the invitation grants once the account exists: a tenant role in its
   * tenant, or platform administration. The latter is valid only in the platform
   * scope, where only the deployment's own start-up creates invitations
   * (`InviteBootstrapAdmins`); anywhere else it is refused like an unknown link.
   */
  private grant(
    invitation: Invitation,
    userId: ActorId,
  ): AppResultAsync<void, AcceptInvitationError> {
    const { members } = this.deps;
    if (invitation.role !== PLATFORM_ADMIN_ROLE) {
      return members.replaceRoles(userId, invitation.tenantId, [invitation.role]);
    }
    return invitation.tenantId === PLATFORM_TENANT_ID
      ? members.setPlatformAdmin(userId, true)
      : errAsync(invalidToken());
  }

  private join(
    invitation: Invitation,
    draft: Parameters<AuthenticationDependencies['authenticator']['signUp']>[0],
  ): AppResultAsync<undefined, AcceptInvitationError> {
    const { invitations, directory, authenticator, audit, clock } = this.deps;

    return invitations
      .claim(invitation.id, clock.now())
      .andThen((isClaimed): AppResultAsync<undefined, AcceptInvitationError> => {
        if (!isClaimed) {
          return errAsync(invalidToken());
        }
        return authenticator
          .signUp(draft)
          .andThen(() => directory.findByEmail(invitation.email))
          .andThen((user) =>
            user === null
              ? errAsync<undefined, AcceptInvitationError>(
                  invitationFailed('account missing after sign-up'),
                )
              : this.grant(invitation, user.id).map(() => {
                  audit.record({
                    type: 'invitation.accepted',
                    tenantId: invitation.tenantId,
                    invitationId: invitation.id,
                    subjectId: user.id,
                  });
                  return undefined;
                }),
          )
          .orElse((error) =>
            invitations
              .release(invitation.id)
              .andThen(() => errAsync<undefined, AcceptInvitationError>(error)),
          );
      });
  }
}
