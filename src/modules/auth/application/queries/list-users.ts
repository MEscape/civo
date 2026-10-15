import type { InfrastructureAppError } from '@lib/errors';
import { clampToLastPage, toPage } from '@lib/pagination';
import type { Page, PageRequest, SortSpec } from '@lib/pagination';
import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { actorHasPermission } from '../../domain/models/authorize';

import type { TenantRole } from '../../domain/models/role';
import type { UserSortField } from '../../domain/ports/user-directory.port';
import type { UserAdministrationDependencies } from '../auth-dependencies';
import type { AuthorizationError } from '../authorization-service';
import type { UserView } from '../contracts/user-views';

export interface ListUsersOptions {
  readonly text: string | null;
  readonly role: TenantRole | null;
  readonly sort: SortSpec<UserSortField>;
  readonly page: PageRequest;
}

export interface UserListing {
  readonly users: Page<UserView>;
  /** True when the tenant has more members than one listing reads; narrow the filters. */
  readonly isTruncated: boolean;
  /** Whether the actor may invite, change roles and remove (user.manage); the screens hide what they could not do. */
  readonly canManage: boolean;
  /** The actor, so a row can say you and offer no self-service role change. */
  readonly selfId: string;
}

/**
 * The members of the actor's own tenant, filtered by role and by text,
 * sorted and paginated. The roster of members comes from the membership
 * records (the tenant boundary), the names from the directory, so a user of
 * another tenant is never listed whatever the filter says.
 */
export class ListUsers {
  constructor(private readonly deps: UserAdministrationDependencies) {}

  execute(
    options: ListUsersOptions,
  ): AppResultAsync<UserListing, AuthorizationError | InfrastructureAppError> {
    const { members, directory, authorization } = this.deps;

    return authorization.requireInTenant('user.read').andThen((actor) =>
      members.listMembers(actor.tenantId, { role: options.role }).andThen((roster) => {
        const ids = [...roster.members.keys()];
        if (ids.length === 0) {
          return okAsync<UserListing>({
            users: toPage([], 0, options.page),
            isTruncated: roster.isTruncated,
            canManage: actorHasPermission(actor, 'user.manage'),
            selfId: actor.id,
          });
        }
        const search = (page: PageRequest) =>
          directory.search({ ids, text: options.text, sort: options.sort, page });

        return search(options.page).andThen((first) => {
          // The page may lie past the end after a filter narrowed the list: show the last page instead.
          const request = clampToLastPage(options.page, first.total);
          return (request.page === first.page ? okAsync(first) : search(request)).map(
            (found): UserListing => ({
              users: toPage(
                found.items.map((user) => ({
                  id: user.id,
                  email: user.email,
                  name: user.name,
                  emailVerified: user.emailVerified,
                  createdAt: user.createdAt,
                  roles: roster.members.get(user.id) ?? [],
                })),
                found.total,
                request,
              ),
              isTruncated: roster.isTruncated,
              canManage: actorHasPermission(actor, 'user.manage'),
              selfId: actor.id,
            }),
          );
        });
      }),
    );
  }
}
