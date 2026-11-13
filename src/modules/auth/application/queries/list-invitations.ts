import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { loadClampedPage } from '@lib/pagination';
import type { PageRequest } from '@lib/pagination';
import type { AppResultAsync } from '@lib/result';
import { unique } from '@lib/utils';

import { PLATFORM_TENANT_ID } from '../../domain/models/tenant';
import { MAX_WEBSITE_OPTIONS } from '../auth-limits';
import { loadAuthorizedInvitationScope } from '../services/load-authorized-invitation-scope';

import type { UserAdministrationDependencies } from '../auth-dependencies';
import type { AuthorizationError } from '../authorization-service';
import type {
  InvitationListScope,
  InvitationListing,
  InvitationView,
} from '../contracts/user-views';

/** The invitations of the authorized scope that can still be accepted, newest first. */
export class ListInvitations {
  constructor(private readonly deps: UserAdministrationDependencies) {}

  execute(
    page: PageRequest,
    scope?: InvitationListScope,
  ): AppResultAsync<
    InvitationListing,
    AuthorizationError | InfrastructureAppError | ValidationAppError
  > {
    const { invitations, tenants, clock } = this.deps;
    return loadAuthorizedInvitationScope(this.deps, scope).andThen(({ tenantIds, isTruncated }) =>
      loadClampedPage(page, (selectedPage) =>
        invitations.listOpenForTenants(tenantIds, clock.now(), selectedPage),
      ).andThen((found) =>
        // Only the websites of this page are named: the platform's own scope is no website.
        tenants
          .listNames(
            unique(found.items.map(({ tenantId }) => tenantId)).filter(
              (id) => id !== PLATFORM_TENANT_ID,
            ),
            MAX_WEBSITE_OPTIONS,
          )
          .map(({ websites }) => ({
            ...found,
            isTruncated,
            items: found.items.map((invitation): InvitationView => ({
              id: invitation.id,
              tenantId: invitation.tenantId,
              websiteName:
                websites.find((website) => website.id === invitation.tenantId)?.name ?? null,
              email: invitation.email,
              role: invitation.role,
              expiresAt: invitation.expiresAt,
              createdAt: invitation.createdAt,
            })),
          })),
      ),
    );
  }
}
