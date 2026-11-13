import type { AppResultAsync } from '@lib/result';

import {
  nameReachedWebsites,
  resolveTenantReach,
} from '../services/load-authorized-user-management';

import type { Permission } from '../../domain/models/permission';
import type { WebsiteAccessDependencies } from '../auth-dependencies';
import type { AccessibleWebsites } from '../contracts/user-views';
import type { ScopeError } from '../services/load-authorized-user-management';

export type ListAccessibleWebsitesError = ScopeError;

/**
 * @authorization system Called only by internal composition adapters to discover tenant reach for an actor.
 *
 * The websites where the signed-in actor holds `permission`, from the actor's own memberships and
 * the role table, never from a request. Platform administrators reach every website, so they get no
 * allowlist; everyone else gets the websites they hold it in, at most `MAX_WEBSITE_OPTIONS`,
 * reported as truncated beyond that. An actor who holds the permission nowhere is refused, like any
 * other caller without it.
 */
export class ListAccessibleWebsites {
  constructor(private readonly deps: WebsiteAccessDependencies) {}

  execute(permission: Permission): AppResultAsync<AccessibleWebsites, ListAccessibleWebsitesError> {
    const { authorization, tenants } = this.deps;

    return authorization
      .requireActor()
      .andThen((actor) => resolveTenantReach(this.deps, actor, permission))
      .andThen((reach) =>
        nameReachedWebsites(tenants, reach).map((options): AccessibleWebsites => ({
          ...options,
          isPlatform: reach.tenantIds === null,
        })),
      );
  }
}
