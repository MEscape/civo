import type { InfrastructureAppError } from '@lib/errors';
import type { Page, PageRequest } from '@lib/pagination';
import type { AppResultAsync } from '@lib/result';

import type { UserAdministrationDependencies } from '../auth-dependencies';
import type { AuthorizationError } from '../authorization-service';
import type { InvitationView } from '../contracts/user-views';

/** The invitations of the actor's tenant that can still be accepted, newest first. */
export class ListInvitations {
  constructor(private readonly deps: UserAdministrationDependencies) {}

  execute(
    page: PageRequest,
  ): AppResultAsync<Page<InvitationView>, AuthorizationError | InfrastructureAppError> {
    return this.deps.authorization
      .requireInTenant('user.read')
      .andThen((actor) =>
        this.deps.invitations.listOpen(actor.tenantId, this.deps.clock.now(), page),
      )
      .map((found) => ({
        ...found,
        items: found.items.map((invitation): InvitationView => ({
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expiresAt,
          createdAt: invitation.createdAt,
        })),
      }));
  }
}
