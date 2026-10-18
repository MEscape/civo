import type { InfrastructureAppError } from '@lib/errors';
import { ResultAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { ROLES } from '../../domain/models/role';

import type { UserAdministrationDependencies } from '../auth-dependencies';
import type { AuthorizationError } from '../authorization-service';
import type { MemberSummaryView } from '../contracts/user-views';

/**
 * The size of the actor's tenant at a glance: how many people, how many in
 * each role, and how many invitations are still open. Counts only; the
 * member list itself is `ListUsers`.
 */
export class GetMemberSummary {
  constructor(private readonly deps: UserAdministrationDependencies) {}

  execute(): AppResultAsync<MemberSummaryView, AuthorizationError | InfrastructureAppError> {
    const { authorization, members, invitations, clock } = this.deps;

    return authorization.requireInTenant('user.read').andThen((actor) =>
      ResultAsync.combine([
        members.countMembers(actor.tenantId),
        invitations.countOpen(actor.tenantId, clock.now()),
      ] as const).map(([counts, openInvitations]) => ({
        members: counts.members,
        byRole: ROLES.map((role) => ({ role, count: counts.byRole.get(role) ?? 0 })),
        openInvitations,
      })),
    );
  }
}
