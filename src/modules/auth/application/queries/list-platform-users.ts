import type { InfrastructureAppError } from '@lib/errors';
import type { SortSpec, PageRequest } from '@lib/pagination';
import { ResultAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { toTenantId } from '../../domain/models/ids';
import { MAX_PLATFORM_FILTERED_PEOPLE } from '../auth-limits';

import type { ActorId } from '../../domain/models/ids';
import type { TenantRole } from '../../domain/models/role';
import type { UserSortField } from '../../domain/ports/user-directory.port';
import type { PlatformUserListDependencies } from '../auth-dependencies';
import type { AuthorizationError } from '../authorization-service';
import type { PlatformUserListing } from '../contracts/user-views';

export interface ListPlatformUsersOptions {
  readonly text: string | null;
  /** Only people who work in this website; unchecked here, an id that names none matches nobody. */
  readonly tenantId: string | null;
  readonly role: TenantRole | null;
  /** Only the platform's administrators. */
  readonly onlyPlatformAdmins: boolean;
  readonly sort: SortSpec<UserSortField>;
  readonly page: PageRequest;
}

/**
 * Everyone with an account, across every website, filtered by text, website,
 * role or being an administrator of the platform, sorted and paginated, each
 * with the websites they work in. Needs the platform administrator's
 * permission. The membership records decide who matches a website or role
 * (the directory knows no tenants), the directory names and pages them, and
 * their memberships are read once for the whole page.
 */
/** The administrators of the platform who also match the website or role filter (all of them when there is none). */
function administratorsAmong(
  narrowed: readonly ActorId[] | null,
  admins: readonly ActorId[],
): readonly ActorId[] {
  return narrowed === null ? admins : admins.filter((id) => narrowed.includes(id));
}

export class ListPlatformUsers {
  constructor(private readonly deps: PlatformUserListDependencies) {}

  execute(
    options: ListPlatformUsersOptions,
  ): AppResultAsync<PlatformUserListing, AuthorizationError | InfrastructureAppError> {
    const { authorization, members, directory } = this.deps;

    return authorization.requireInTenant('platform.admin.manage').andThen((actor) =>
      ResultAsync.combine([members.listPlatformAdmins(), this.narrow(options)] as const).andThen(
        ([admins, narrowed]) => {
          const ids = options.onlyPlatformAdmins
            ? administratorsAmong(narrowed.ids, admins)
            : narrowed.ids;
          return directory
            .search({ ids, text: options.text, sort: options.sort, page: options.page })
            .andThen((found) =>
              members.listMembershipsOf(found.items.map((user) => user.id)).map((memberships) => ({
                users: {
                  ...found,
                  items: found.items.map((user) => ({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    emailVerified: user.emailVerified,
                    createdAt: user.createdAt,
                    isPlatformAdmin: admins.includes(user.id),
                    memberships: (memberships.get(user.id) ?? []).map(({ tenantId, roles }) => ({
                      tenantId,
                      roles,
                    })),
                  })),
                },
                isTruncated: narrowed.isTruncated,
                selfId: actor.id,
              })),
            );
        },
      ),
    );
  }

  /** The people a website or role filter leaves, or `null` when neither is set: everyone. */
  private narrow(
    options: ListPlatformUsersOptions,
  ): AppResultAsync<
    { readonly ids: readonly ActorId[] | null; readonly isTruncated: boolean },
    InfrastructureAppError
  > {
    if (options.tenantId === null && options.role === null) {
      return okAsync({ ids: null, isTruncated: false });
    }
    return this.deps.members.findMemberIds(
      {
        tenantId: options.tenantId === null ? null : toTenantId(options.tenantId),
        role: options.role,
      },
      MAX_PLATFORM_FILTERED_PEOPLE,
    );
  }
}
