import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { PLATFORM_TENANT_ID } from '../../domain/models/tenant';

import {
  loadAuthorizedManagedWebsite,
  loadAuthorizedPlatform,
  loadAuthorizedUserManagementScope,
  loadAuthorizedWebsite,
  selectWebsiteInScope,
} from './load-authorized-user-management';

import type { UserAdministrationDependencies } from '../auth-dependencies';
import type { AuthorizedScope, ScopeError, TenantReach } from './load-authorized-user-management';
import type { InvitationListScope } from '../contracts/user-views';

/** The scopes whose offers an actor may read; `tenantIds: null` is every scope, the platform's own included. */
export type InvitationScope = TenantReach;

/** Read offers only from explicitly authorized website scopes; platform offers require platform authority. */
export function loadAuthorizedInvitationScope(
  deps: UserAdministrationDependencies,
  scope?: InvitationListScope,
): AppResultAsync<InvitationScope, ScopeError> {
  if (scope?.kind !== 'global') {
    return loadAuthorizedWebsite(deps, { permission: 'user.read', tenantId: scope?.tenantId }).map(
      ({ tenantId }) => ({ tenantIds: [tenantId], isTruncated: false }),
    );
  }
  const requestedTenantId = scope.tenantId;
  return loadAuthorizedUserManagementScope(deps).andThen(
    ({ tenantIds, isTruncated }): AppResultAsync<InvitationScope, ScopeError> => {
      if (requestedTenantId === undefined) {
        return okAsync({ tenantIds, isTruncated });
      }
      const selected = selectWebsiteInScope(tenantIds, requestedTenantId);
      return selected.isErr()
        ? errAsync(selected.error)
        : okAsync({ tenantIds: [selected.value], isTruncated: false });
    },
  );
}

/** Mutations must name their scope; the legacy tenant default never grants platform administration. */
export function loadAuthorizedInvitationRevocation(
  deps: UserAdministrationDependencies,
  tenantId?: string,
): AppResultAsync<AuthorizedScope, ScopeError> {
  return tenantId === PLATFORM_TENANT_ID
    ? loadAuthorizedPlatform(deps)
    : loadAuthorizedManagedWebsite(deps, tenantId);
}
