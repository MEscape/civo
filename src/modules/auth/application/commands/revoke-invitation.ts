import type { InfrastructureAppError } from '@lib/errors';
import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { parseInvitationId } from '../../domain/models/ids';

import type { UserAdministrationDependencies } from '../auth-dependencies';
import type { AuthorizationError } from '../authorization-service';

/**
 * Withdraws an invitation of the actor's tenant. Idempotent; the tenant is in
 * the lookup, so another tenant's id matches nothing, and an id that is not
 * one is simply "already gone".
 */
export class RevokeInvitation {
  constructor(private readonly deps: UserAdministrationDependencies) {}

  execute(
    rawInvitationId: string,
  ): AppResultAsync<undefined, AuthorizationError | InfrastructureAppError> {
    const { authorization, invitations, audit } = this.deps;
    return authorization.requireInTenant('user.manage').andThen((actor) => {
      const invitationId = parseInvitationId(rawInvitationId);
      if (invitationId.isErr()) {
        return okAsync(undefined);
      }
      return invitations.revoke(invitationId.value, actor.tenantId).map(() => {
        audit.record({
          type: 'invitation.revoked',
          actorId: actor.id,
          tenantId: actor.tenantId,
          invitationId: invitationId.value,
        });
        return undefined;
      });
    });
  }
}
