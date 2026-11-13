import type { AppResultAsync } from '@lib/result';

import {
  loadAuthorizedUserManagementScope,
  nameReachedWebsites,
} from '../services/load-authorized-user-management';

import type { ListManageableWebsitesDependencies } from '../auth-dependencies';
import type { WebsiteOptions } from '../contracts/user-views';
import type { ScopeError } from '../services/load-authorized-user-management';

export type ListManageableWebsitesError = ScopeError;

/** Website names for management selectors obey exactly the same scope as users and mutations. */
export class ListManageableWebsites {
  constructor(private readonly deps: ListManageableWebsitesDependencies) {}

  execute(): AppResultAsync<WebsiteOptions, ListManageableWebsitesError> {
    return loadAuthorizedUserManagementScope(this.deps).andThen((scope) =>
      nameReachedWebsites(this.deps.tenants, scope),
    );
  }
}
