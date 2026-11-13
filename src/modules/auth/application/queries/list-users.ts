import { loadClampedPage, toPage } from '@lib/pagination';
import type { Page, PageRequest } from '@lib/pagination';
import { ResultAsync, okAsync, errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { tenantInvalid } from '../../domain/errors/auth-errors';
import { actorHasPermission } from '../../domain/models/authorize';
import { listPlatformAdministratorIds } from '../services/list-platform-administrator-ids';
import { loadAuthorizedWebsite } from '../services/load-authorized-user-management';
import { toAccountView } from '../user-view-mappers';

import type { Actor } from '../../domain/models/actor';
import type { TenantId } from '../../domain/models/ids';
import type { UserAdministrationDependencies } from '../auth-dependencies';
import type { ListUsersOptions, UserListing, UserView } from '../contracts/user-views';
import type { ScopeError } from '../services/load-authorized-user-management';

/**
 * The members of the actor's own tenant, filtered by role and by text,
 * sorted and paginated. The roster of members comes from the membership
 * records (the tenant boundary), the names from the directory, so a user of
 * another tenant is never listed whatever the filter says. A member who also
 * administers the platform is marked, so the website can see it without being
 * able to change it.
 */
export class ListUsers {
  constructor(private readonly deps: UserAdministrationDependencies) {}

  execute(options: ListUsersOptions): AppResultAsync<UserListing, ScopeError> {
    return loadAuthorizedWebsite(this.deps, {
      permission: 'user.read',
      tenantId: options.tenantId,
    }).andThen(({ actor, tenantId }) => this.list(options, actor, tenantId));
  }

  private list(
    options: ListUsersOptions,
    actor: Actor,
    tenantId: TenantId,
  ): AppResultAsync<UserListing, ScopeError> {
    const { members, directory, tenants } = this.deps;

    return ResultAsync.combine([
      members.listMembers(tenantId, {
        role: options.role === 'platform_admin' ? null : options.role,
      }),
      listPlatformAdministratorIds(this.deps),
      tenants.findName(tenantId),
    ] as const).andThen(
      ([roster, platformAdmins, websiteName]): AppResultAsync<UserListing, ScopeError> => {
        if (websiteName === null) {
          return errAsync(tenantInvalid());
        }
        const adminIds = new Set(platformAdmins.ids);
        const toListing = (users: Page<UserView>): UserListing => ({
          users,
          tenantId,
          websiteName,
          isTruncated: roster.isTruncated || platformAdmins.isTruncated,
          canManage: actorHasPermission(actor, 'user.manage'),
          selfId: actor.id,
        });
        const ids = [...roster.members.keys()].filter(
          (id) => options.role !== 'platform_admin' || adminIds.has(id),
        );
        if (ids.length === 0) {
          return okAsync(toListing(toPage([], 0, options.page)));
        }
        const search = (page: PageRequest) =>
          directory.search({ ids, text: options.text, sort: options.sort, page });

        return loadClampedPage(options.page, search).map((found) =>
          toListing(
            toPage(
              found.items.map((user): UserView => ({
                ...toAccountView(user, adminIds.has(user.id)),
                roles: roster.members.get(user.id) ?? [],
              })),
              found.total,
              found,
            ),
          ),
        );
      },
    );
  }
}
