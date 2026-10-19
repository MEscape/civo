import type { InfrastructureAppError, RateLimitedAppError, ValidationAppError } from '@lib/errors';
import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { fromRateLimitFailure } from '../../domain/errors/auth-errors';
import { INVITATION_LIFETIME_MS, createInvitationOffer } from '../../domain/models/invitation';
import { ROLES } from '../../domain/models/role';
import { AUTH_RATE_LIMITS } from '../rate-limits';

import type { Actor } from '../../domain/models/actor';
import type { InvitationOffer } from '../../domain/models/invitation';
import type { MailLocale } from '../../domain/ports/auth-mailer.port';
import type { InviteUserDependencies } from '../auth-dependencies';
import type { AuthorizationError } from '../authorization-service';
import type { InviteOutcome } from '../contracts/user-views';

export type InviteUserError =
  AuthorizationError | InfrastructureAppError | RateLimitedAppError | ValidationAppError;

export interface InviteUserInput {
  readonly email: string;
  readonly role: string;
  /** The language of the invitation mail: the inviting administrator's. */
  readonly locale: MailLocale;
}

/**
 * Gives a person access to the actor's tenant, by the only two doors there
 * are (sign-up is closed):
 *
 *  - an address that already has an account gets the role at once;
 *  - any other address gets a single-use, expiring link by email, through
 *    which the person sets a name and password and joins with that role.
 *
 * Only the hash of the link's token is stored, and the address is fixed by
 * the invitation, so the link cannot be used to open an account for anyone
 * else. Each invitation to a new address sends a mail, so how many one
 * administrator may send is limited.
 */
export class InviteUser {
  constructor(private readonly deps: InviteUserDependencies) {}

  execute(input: InviteUserInput): AppResultAsync<InviteOutcome, InviteUserError> {
    const { authorization, rateLimiter } = this.deps;

    return authorization.requireInTenant('user.manage').andThen((actor) => {
      const offer = createInvitationOffer(input);
      if (offer.isErr()) {
        return errAsync(offer.error);
      }

      return rateLimiter
        .enforce({
          policy: AUTH_RATE_LIMITS.inviteUser,
          subject: { kind: 'actor', tenantId: actor.tenantId, actorId: actor.id },
        })
        .mapErr(fromRateLimitFailure)
        .andThen(() => this.invite(actor, offer.value, input.locale));
    });
  }

  private invite(
    actor: Actor,
    { email, role }: InvitationOffer,
    locale: MailLocale,
  ): AppResultAsync<InviteOutcome, InviteUserError> {
    const { directory, members, invitations, tokens, mailer, audit, clock } = this.deps;

    return directory
      .findByEmail(email)
      .andThen((existing): AppResultAsync<InviteOutcome, InviteUserError> => {
        if (existing !== null) {
          return members
            .findRoles(existing.id, actor.tenantId)
            .andThen((current) => {
              const wanted = ROLES.filter(
                (candidate) => candidate === role || current.includes(candidate),
              );
              return members.replaceRoles(existing.id, actor.tenantId, wanted);
            })
            .map((): InviteOutcome => {
              audit.record({
                type: 'membership.roles_changed',
                actorId: actor.id,
                tenantId: actor.tenantId,
                subjectId: existing.id,
              });
              return 'granted';
            });
        }

        const issued = tokens.issue();
        return invitations
          .create({
            tenantId: actor.tenantId,
            email,
            role,
            invitedBy: actor.id,
            expiresAt: new Date(clock.now().getTime() + INVITATION_LIFETIME_MS),
            tokenHash: issued.hash,
          })
          .andThen((invitation) =>
            mailer
              .sendInvitation({ to: email, token: issued.token, locale })
              // A link nobody received must not stay claimable.
              .orElse((error) =>
                invitations
                  .revoke(invitation.id, actor.tenantId)
                  .andThen(() => errAsync<undefined, InfrastructureAppError>(error)),
              )
              .map((): InviteOutcome => {
                audit.record({
                  type: 'invitation.created',
                  actorId: actor.id,
                  tenantId: actor.tenantId,
                  invitationId: invitation.id,
                });
                return 'invited';
              }),
          );
      });
  }
}
