import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { parseInvitationId } from '../../domain/models/ids';
import { loadAuthorizedInvitationRevocation } from '../services/load-authorized-invitation-scope';

import type { UserAdministrationDependencies } from '../auth-dependencies';
import type { AuthorizationError } from '../authorization-service';

/**
 * Withdraws an invitation of the named scope: a website the actor manages, or the platform's own
 * (platform administrators only). Idempotent; the scope is in the lookup, so another scope's id
 * matches nothing, and an id that is not one is simply "already gone".
 */
export class RevokeInvitation {
  constructor(private readonly deps: UserAdministrationDependencies) {}

  execute(
    rawInvitationId: string,
    tenantId?: string,
  ): AppResultAsync<undefined, AuthorizationError | InfrastructureAppError | ValidationAppError> {
    const { invitations, audit } = this.deps;
    return loadAuthorizedInvitationRevocation(this.deps, tenantId).andThen(
      ({ actor, tenantId: target }) => {
        const invitationId = parseInvitationId(rawInvitationId);
        if (invitationId.isErr()) {
          return okAsync(undefined);
        }
        return invitations.revoke(invitationId.value, target).map((isRevoked) => {
          // Only a removed offer is an event; revoking a missing, foreign or accepted id leaves no trail entry.
          if (isRevoked) {
            audit.record({
              type: 'invitation.revoked',
              actorId: actor.id,
              tenantId: target,
              invitationId: invitationId.value,
            });
          }
          return undefined;
        });
      },
    );
  }
}
