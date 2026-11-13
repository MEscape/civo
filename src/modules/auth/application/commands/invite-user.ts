import type { ConflictAppError, InfrastructureAppError, RateLimitedAppError } from '@lib/errors';
import { errAsync, okAsync, ResultAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { fromRateLimitFailure, membershipExists } from '../../domain/errors/auth-errors';
import { PLATFORM_TENANT_ID } from '../../domain/models/tenant';
import { AUTH_RATE_LIMITS } from '../rate-limits';
import { findAccount } from '../services/find-account';
import { isPlatformAdministrator } from '../services/is-platform-administrator';
import { issueInvitation } from '../services/issue-invitation';
import { loadAuthorizedInvitationTarget } from '../services/load-authorized-invitation-target';

import type { InviteUserDependencies } from '../auth-dependencies';
import type { InviteUserInput } from '../contracts/auth-inputs';
import type { InvitationTarget } from '../services/load-authorized-invitation-target';
import type { ScopeError } from '../services/load-authorized-user-management';

type InviteUserError = ScopeError | ConflictAppError | RateLimitedAppError;

/**
 * A request for one explicit access scope, for both new and existing accounts.
 * Existing memberships and pending offers are conflicts; account existence alone is not.
 * Access is never granted here: the intended account must explicitly accept its offer.
 * @audit-exempt Successful invitation issuance is audited by the shared issueInvitation service.
 */
export class InviteUser {
  constructor(private readonly deps: InviteUserDependencies) {}

  execute(input: InviteUserInput): AppResultAsync<undefined, InviteUserError> {
    return loadAuthorizedInvitationTarget(this.deps, input).andThen((target) =>
      this.spendInvitationBudget(target)
        .andThen(() => this.rejectExistingAccess(target))
        .andThen(() => this.issue(target, input.locale)),
    );
  }

  /** Every invitation sends a mail, so one administrator's budget per scope is bounded. */
  private spendInvitationBudget({
    actor,
    tenantId,
  }: InvitationTarget): AppResultAsync<undefined, RateLimitedAppError | InfrastructureAppError> {
    return this.deps.rateLimiter
      .enforce({
        policy: AUTH_RATE_LIMITS.inviteUser,
        subject: { kind: 'actor', tenantId, actorId: actor.id },
      })
      .mapErr(fromRateLimitFailure)
      .map(() => undefined);
  }

  private rejectExistingAccess({
    email,
    tenantId,
  }: InvitationTarget): AppResultAsync<undefined, InfrastructureAppError | ConflictAppError> {
    return this.deps.directory.findByEmail(email).andThen((existing) => {
      if (existing === null) {
        return okAsync(undefined);
      }
      const access =
        tenantId === PLATFORM_TENANT_ID
          ? isPlatformAdministrator(this.deps, existing)
          : this.deps.members.findRoles(existing.id, tenantId).map((roles) => roles.length > 0);
      return access.andThen((hasAccess) =>
        hasAccess ? errAsync(membershipExists()) : okAsync(undefined),
      );
    });
  }

  private issue(
    { actor, tenantId, email, role }: InvitationTarget,
    locale: InviteUserInput['locale'],
  ): AppResultAsync<undefined, InfrastructureAppError | ConflictAppError> {
    const { directory, tenants } = this.deps;

    return ResultAsync.combine([
      findAccount(directory, actor.id),
      tenantId === PLATFORM_TENANT_ID ? okAsync(null) : tenants.findName(tenantId),
    ] as const)
      .andThen(([inviter, websiteName]) =>
        issueInvitation(this.deps, {
          tenantId,
          email,
          role,
          invitedBy: actor.id,
          locale,
          inviterName: inviter?.name ?? null,
          websiteName,
        }),
      )
      .map(() => undefined);
  }
}
