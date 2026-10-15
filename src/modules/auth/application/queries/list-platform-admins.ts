import type { InfrastructureAppError } from '@lib/errors';
import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { MAX_PLATFORM_ADMINS_LISTED } from '../auth-limits';

import type { UserAdministrationDependencies } from '../auth-dependencies';
import type { AuthorizationError } from '../authorization-service';
import type { PlatformAdminView } from '../contracts/platform-admin-views';

/** The platform administrators by membership (the deployment's e-mail list is configuration, not data). */
export class ListPlatformAdmins {
  constructor(private readonly deps: UserAdministrationDependencies) {}

  execute(): AppResultAsync<
    readonly PlatformAdminView[],
    AuthorizationError | InfrastructureAppError
  > {
    const { authorization, members, directory } = this.deps;

    return authorization.requireInTenant('platform.admin.manage').andThen(() =>
      members.listPlatformAdmins().andThen((ids) =>
        ids.length === 0
          ? okAsync([])
          : directory
              .search({
                ids,
                text: null,
                sort: { field: 'email', direction: 'asc' },
                page: { page: 1, pageSize: MAX_PLATFORM_ADMINS_LISTED },
              })
              .map((found) =>
                found.items.map((user) => ({
                  id: user.id,
                  email: user.email,
                  name: user.name,
                })),
              ),
      ),
    );
  }
}
