import type { InfrastructureAppError } from '@lib/errors';
import { loadClampedPage } from '@lib/pagination';
import { ResultAsync, errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { MAX_PLATFORM_FILTERED_PEOPLE } from '../auth-limits';
import { listPlatformAdministratorIds } from '../services/list-platform-administrator-ids';
import {
  loadAuthorizedUserManagementScope,
  selectWebsiteInScope,
} from '../services/load-authorized-user-management';
import { toAccountView } from '../user-view-mappers';

import type { ActorId, TenantId } from '../../domain/models/ids';
import type { PlatformUserListDependencies } from '../auth-dependencies';
import type { ListPlatformUsersOptions, PlatformUserListing } from '../contracts/user-views';
import type { ScopeError, UserManagementScope } from '../services/load-authorized-user-management';

/** The administrators of the platform who also match the website or role filter (all of them when there is none). */
function administratorsAmong(
  narrowed: readonly ActorId[] | null,
  admins: readonly ActorId[],
): readonly ActorId[] {
  if (narrowed === null) {
    return admins;
  }
  const matching = new Set(narrowed);
  return admins.filter((id) => matching.has(id));
}

/**
 * Everyone with an account, across every website, filtered by text, website,
 * role or being an administrator of the platform, sorted and paginated, each
 * with the websites they work in. Needs the platform administrator's
 * permission. The membership records decide who matches a website or role
 * (the directory knows no tenants), the directory names and pages them, and
 * their memberships are read once for the whole page.
 */
export class ListPlatformUsers {
  constructor(private readonly deps: PlatformUserListDependencies) {}

  execute(options: ListPlatformUsersOptions): AppResultAsync<PlatformUserListing, ScopeError> {
    return loadAuthorizedUserManagementScope(this.deps).andThen(
      (scope): AppResultAsync<PlatformUserListing, ScopeError> => {
        if (options.tenantId === null) {
          return this.list(options, scope, null);
        }
        const selected = selectWebsiteInScope(scope.tenantIds, options.tenantId);
        return selected.isErr()
          ? errAsync(selected.error)
          : this.list(options, scope, selected.value);
      },
    );
  }

  private list(
    options: ListPlatformUsersOptions,
    { actor, tenantIds, isTruncated: isScopeTruncated }: UserManagementScope,
    selectedTenantId: TenantId | null,
  ): AppResultAsync<PlatformUserListing, ScopeError> {
    const { members, directory } = this.deps;

    return ResultAsync.combine([
      listPlatformAdministratorIds(this.deps),
      this.narrow(options, tenantIds, selectedTenantId),
    ] as const).andThen(([{ ids: admins, isTruncated: isAdminListTruncated }, narrowed]) => {
      const adminIds = new Set(admins);
      const ids = options.onlyPlatformAdmins
        ? administratorsAmong(narrowed.ids, admins)
        : narrowed.ids;

      return loadClampedPage(options.page, (page) =>
        directory.search({ ids, text: options.text, sort: options.sort, page }),
      ).andThen((found) =>
        members
          .listMembershipsOf(
            found.items.map((user) => user.id),
            tenantIds ?? undefined,
          )
          .map((memberships) => ({
            canManagePlatform: tenantIds === null,
            manageableTenantIds: tenantIds,
            users: {
              ...found,
              items: found.items.map((user) => ({
                ...toAccountView(user, adminIds.has(user.id)),
                // The scope is enforced again here: a manager sees only the websites they manage.
                memberships: (memberships.get(user.id) ?? [])
                  .filter(({ tenantId }) => tenantIds === null || tenantIds.includes(tenantId))
                  .map(({ tenantId, roles }) => ({ tenantId, roles })),
              })),
            },
            isTruncated: narrowed.isTruncated || isScopeTruncated || isAdminListTruncated,
            selfId: actor.id,
          })),
      );
    });
  }

  /** The people a website or role filter leaves, or `null` when neither is set: everyone. */
  private narrow(
    options: ListPlatformUsersOptions,
    tenantIds: readonly TenantId[] | null,
    selectedTenantId: TenantId | null,
  ): AppResultAsync<
    { readonly ids: readonly ActorId[] | null; readonly isTruncated: boolean },
    InfrastructureAppError
  > {
    if (tenantIds === null && selectedTenantId === null && options.role === null) {
      return okAsync({ ids: null, isTruncated: false });
    }
    return this.deps.members.findMemberIds(
      {
        tenantId: selectedTenantId,
        role: options.role,
        ...(tenantIds === null ? {} : { tenantIds }),
      },
      MAX_PLATFORM_FILTERED_PEOPLE,
    );
  }
}
