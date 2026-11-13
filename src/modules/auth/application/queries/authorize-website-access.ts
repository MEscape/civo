import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { permissionDenied } from '../../domain/errors/auth-errors';
import {
  hasPlatformAuthority,
  loadAuthorizedWebsite,
} from '../services/load-authorized-user-management';

import type { TenantId } from '../../domain/models/ids';
import type { Permission } from '../../domain/models/permission';
import type { WebsiteAccessDependencies } from '../auth-dependencies';
import type { ScopeError } from '../services/load-authorized-user-management';

export type AuthorizeWebsiteAccessError = ScopeError;

/**
 * Whether the signed-in actor holds `permission` in the named website, decided from the actor's own
 * memberships in that website (a platform administrator reaches every website that exists). The id
 * may come from an address, so it is validated here; whichever website the actor currently has open
 * is irrelevant, so a person who manages several websites can use any of them. Fails with the one
 * `forbidden` error for a stranger and a missing website alike.
 */
export class AuthorizeWebsiteAccess {
  constructor(private readonly deps: WebsiteAccessDependencies) {}

  execute(
    permission: Permission,
    rawTenantId: string,
  ): AppResultAsync<TenantId, AuthorizeWebsiteAccessError> {
    return loadAuthorizedWebsite(this.deps, { permission, tenantId: rawTenantId }).andThen(
      ({ actor, tenantId }): AppResultAsync<TenantId, AuthorizeWebsiteAccessError> =>
        // A member's website exists by their membership; platform authority also reaches ids that name no website.
        hasPlatformAuthority(actor)
          ? this.deps.tenants
              .exists(tenantId)
              .andThen((exists) => (exists ? okAsync(tenantId) : errAsync(permissionDenied())))
          : okAsync(tenantId),
    );
  }
}
