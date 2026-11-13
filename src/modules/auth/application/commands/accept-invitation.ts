import type { InfrastructureAppError, UnauthorizedAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  emailNotVerified,
  fromRateLimitFailure,
  invalidToken,
  invitationAccountRequired,
  invitationFailed,
} from '../../domain/errors/auth-errors';
import { createSignUpDraft } from '../../domain/models/credentials';
import { AUTH_RATE_LIMITS } from '../rate-limits';
import { enforceClientLimit } from '../services/enforce-rate-limit';
import { findSignedInActor } from '../services/find-signed-in-actor';
import { loadAcceptableInvitation } from '../services/load-acceptable-invitation';

import type { ActorId } from '../../domain/models/ids';
import type { Invitation } from '../../domain/models/invitation';
import type { AuthenticatorError } from '../../domain/ports/authenticator.port';
import type { AcceptInvitationDependencies } from '../auth-dependencies';
import type { AcceptInvitationOutcome } from '../contracts/invitation-views';
import type { RateLimitError } from '../services/enforce-rate-limit';

export type AcceptInvitationError =
  | AuthenticatorError
  | RateLimitError
  | InfrastructureAppError
  | UnauthorizedAppError
  | ValidationAppError;

export interface AcceptInvitationInput {
  readonly token: string;
  readonly name?: string | undefined;
  readonly password?: string | undefined;
}

type Outcome = AppResultAsync<AcceptInvitationOutcome, AcceptInvitationError>;

/**
 * Existing accounts accept through their verified session, never by resetting credentials.
 * New accounts first verify and sign in; account setup leaves the offer open.
 * The application-database transaction consumes the invitation and grants its exact access together.
 *
 * @authorization public The single-use token permits account setup; granting access also requires the intended verified account.
 */
export class AcceptInvitation {
  constructor(private readonly deps: AcceptInvitationDependencies) {}

  execute(
    input: AcceptInvitationInput,
  ): AppResultAsync<AcceptInvitationOutcome, AcceptInvitationError> {
    return enforceClientLimit(this.deps, AUTH_RATE_LIMITS.signUpClient)
      .andThen(() => loadAcceptableInvitation(this.deps, input.token))
      .andThen(({ invitation, bootstrapAuthority }) =>
        this.join(invitation, input, bootstrapAuthority),
      );
  }

  private join(
    invitation: Invitation,
    input: AcceptInvitationInput,
    bootstrapAuthority: boolean,
  ): Outcome {
    // A consumed link answers like an unknown one to everybody except its verified, signed-in account.
    const isRepeat = invitation.acceptedAt !== null;
    const refuse = (error: AcceptInvitationError) => errAsync(isRepeat ? invalidToken() : error);

    return this.deps.directory.findByEmail(invitation.email).andThen((account) =>
      findSignedInActor(this.deps.currentActor).andThen((actor): Outcome => {
        if (account === null) {
          return actor === null && !isRepeat
            ? this.createAccount(invitation, input)
            : refuse(invitationAccountRequired());
        }
        if (actor?.id !== account.id) {
          return refuse(invitationAccountRequired());
        }
        if (!account.emailVerified) {
          return refuse(emailNotVerified());
        }
        return this.grantAccess(invitation, account.id, bootstrapAuthority);
      }),
    );
  }

  private grantAccess(
    invitation: Invitation,
    accountId: ActorId,
    bootstrapAuthority: boolean,
  ): Outcome {
    const { invitations, clock, audit } = this.deps;
    return invitations
      .accept({ id: invitation.id, actorId: accountId, now: clock.now(), bootstrapAuthority })
      .andThen((outcome): Outcome => {
        if (outcome === 'unavailable') {
          return errAsync(invalidToken());
        }
        // Unchanged access (an existing role is never widened by an offer) is not an event.
        if (outcome === 'accepted') {
          audit.record({
            type: 'invitation.accepted',
            tenantId: invitation.tenantId,
            invitationId: invitation.id,
            subjectId: accountId,
            role: invitation.role,
          });
        }
        return okAsync({ status: outcome });
      });
  }

  private createAccount(invitation: Invitation, input: AcceptInvitationInput): Outcome {
    return createSignUpDraft({
      name: input.name ?? '',
      email: invitation.email,
      password: input.password ?? '',
    })
      .asyncAndThen((draft) =>
        this.deps.rateLimiter
          .enforce({
            policy: AUTH_RATE_LIMITS.signUp,
            subject: { kind: 'identifier', value: invitation.email },
          })
          .mapErr(fromRateLimitFailure)
          .map(() => draft),
      )
      .andThen((draft) => this.deps.authenticator.signUp(draft, input.token))
      .andThen(() => this.deps.directory.findByEmail(invitation.email))
      .andThen((account) =>
        account === null
          ? errAsync(invitationFailed('account missing after sign-up'))
          : okAsync<AcceptInvitationOutcome>({ status: 'verify_account' }),
      );
  }
}
